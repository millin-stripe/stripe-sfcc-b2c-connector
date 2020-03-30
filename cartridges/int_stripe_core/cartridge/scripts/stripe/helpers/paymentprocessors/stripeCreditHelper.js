'use strict';

const Transaction = require('dw/system/Transaction');
const PaymentInstrument = require('dw/order/PaymentInstrument');
const PaymentMgr = require('dw/order/PaymentMgr');
const Order = require('dw/order/Order');

function Handle(args) {
    const checkoutHelper = require('*/cartridge/scripts/stripe/helpers/checkoutHelper');
    const paramsMap = request.httpParameterMap;
    const cardType = require('*/cartridge/scripts/stripe/helpers/cardsHelper').getCardType();

    var prUsed = false;
    if (request.httpParameterMap.get('stripe_pr_used').value === 'true') {
        prUsed = true;
    }

    const params = {
        sourceId: paramsMap.stripe_source_id.stringValue,
        cardNumber: paramsMap.stripe_card_number.stringValue,
        cardHolder: paramsMap.stripe_card_holder.stringValue,
        cardType: cardType,
        cardExpMonth: paramsMap.stripe_card_expiration_month.stringValue,
        cardExpYear: paramsMap.stripe_card_expiration_year.stringValue,
        saveCard: paramsMap.stripe_save_card.value,
        prUsed: prUsed
    };

    try {
        Transaction.begin();
        checkoutHelper.createStripePaymentInstrument(args.Basket, PaymentInstrument.METHOD_CREDIT_CARD, params);
        Transaction.commit();
        return {
            success: true
        };
    } catch (e) {
        Transaction.rollback();
        return {
            success: false,
            error: true,
            errorMessage: e.message
        };
    }
}

function Authorize(args) {
    let responsePayload;
    const OrderMgr = require('dw/order/OrderMgr');
    const orderNo = args.OrderNo;
    const paymentInstrument = args.PaymentInstrument;
    const order = OrderMgr.getOrder(orderNo);
    const paymentIntentId = order.custom.stripePaymentIntentID;

    if (!paymentIntentId) {
        responsePayload = {
            authorized: false,
            error: true
        };
    } else {
        const stripeService = require('*/cartridge/scripts/stripe/services/stripeService');

        try {
            const paymentIntent = stripeService.paymentIntents.update(paymentIntentId, {
                metadata: {
                    order_id: orderNo,
                    site_id: dw.system.Site.getCurrent().getID()
                }
            });

            if (paymentIntent.status !== 'succeeded') {
                throw new Error('Payment was not successful, payment intent status is ' + paymentIntent.status);
            }

            const charges = paymentIntent.charges;
            if (!(charges && charges.total_count && charges.data)) {
                throw new Error('Payment was not successful, no charges found');
            }

            const charge = paymentIntent.charges.data[0];
            if (!(charge && charge.id)) {
                throw new Error('Payment was not successful, no valid charge found');
            }

            const paymentProcessor = args.PaymentProcessor || PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()).getPaymentProcessor();
            Transaction.wrap(function () {
                paymentInstrument.custom.stripeChargeID = charge.id;
                paymentInstrument.paymentTransaction.transactionID = charge.balance_transaction;
                paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
                args.Order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
            });

            responsePayload = {
                authorized: true,
                error: false
            };
        } catch (e) {
            responsePayload = {
                authorized: false,
                error: true,
                errorMessage: e.message
            };
        }
    }

    return responsePayload;
}

exports.Handle = Handle;
exports.Authorize = Authorize;