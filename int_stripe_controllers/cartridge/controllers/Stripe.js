'use strict';

/* Script Modules */
var app = require('app_storefront_controllers/cartridge/scripts/app');
var guard = require('app_storefront_controllers/cartridge/scripts/guard');
var Transaction = require('dw/system/Transaction');
var Resource = require('dw/web/Resource');
var PaymentInstrument = require('dw/order/PaymentInstrument');
var URLUtils = require('dw/web/URLUtils');
var Stripe = require('int_stripe/cartridge/scripts/service/stripe');
var StripeHelper = require('int_stripe/cartridge/scripts/stripeHelper');

var dwweb = require('dw/web');
var dworder = require('dw/order');
/**
 * Selects a customer credit card and returns the details of the credit card as
 * JSON response. Required to fill credit card form with details of selected
 * credit card.
 */
function selectCreditCard() {
    var cart, applicableCreditCards, selectedCreditCard, instrumentsIter, creditCardInstrument;
    cart = app.getModel('Cart').get();

    var stripeCreditCards = Stripe.FetchCards();
    selectedCreditCard = null;

    // ensure mandatory parameter 'CreditCardUUID' and 'CustomerPaymentInstruments'
    // in pipeline dictionary and collection is not empty
    if (request.httpParameterMap.creditCardUUID.value && stripeCreditCards && !stripeCreditCards.empty) {

        // find credit card in payment instruments
        instrumentsIter = stripeCreditCards.iterator();
        while (instrumentsIter.hasNext()) {
            creditCardInstrument = instrumentsIter.next();
            if (request.httpParameterMap.creditCardUUID.value.equals(creditCardInstrument.UUID)) {
            	var cardType : String = creditCardInstrument.creditCardType;
            	switch (cardType) {
	                case 'MasterCard':
	                	cardType = 'Master Card';
	                    break;
	                case 'American Express':
	                	cardType = 'Amex';
	                    break;
	                case 'Diners Club':
	                	cardType = 'DinersClub';
	                    break;
	                default:
	                    break;
            	}
            	creditCardInstrument.creditCardType = cardType;
                selectedCreditCard = creditCardInstrument;
            }
        }

        if (selectedCreditCard) {
            app.getForm('billing').object.paymentMethods.creditCard.number.value = selectedCreditCard.maskedCreditCardNumber;
        }
    }

    app.getView({
        SelectedCreditCard: selectedCreditCard
    }).render('checkout/billing/stripecreditcardjson');
}

/**
 * Display Product Feed on storefront
 */
function displayProductFeed() {
	var lines : List = StripeHelper.DisplayProductFeed();
	app.getView({
		Lines: lines
	}).render('feed/displayproductfeed');
}

/**
 * Add new card after billing submit action
 */
function afterSubmitBilling()
{
	if (StripeHelper.IsStripeEnabled()) {
    	var stripeToken = request.httpParameterMap.get('stripeToken');
        if (!stripeToken.isEmpty()) {
        	var cart = app.getModel('Cart').get();
        	var customerEmail : String = '';
        	if (!empty(cart.object.customerEmail)) {
        		customerEmail = cart.object.customerEmail;
        	} else if (customer.authenticated) {
        		customerEmail = customer.profile.email;
        	}
            var paymentInstrument = cart.getPaymentInstruments(dworder.PaymentInstrument.METHOD_CREDIT_CARD)[0];
            var params = {
            		StripeToken: stripeToken.value,
            		PaymentInstrument: paymentInstrument,
            		CustomerEmail : customerEmail
            };
            var result = Stripe.AddCard(params);
            if (result.error) {
            	Transaction.wrap(function () {
            		cart.removePaymentInstrument(paymentInstrument);
            	});
            	if (app.getForm('billing').object.paymentMethods.selectedPaymentMethodID.value.equals(PaymentInstrument.METHOD_CREDIT_CARD)){
            		app.getForm('billing').object.paymentMethods.creditCard.clearFormElement();
            	}
            	app.getForm('billing').object.fulfilled.value = false;

            	var stripeCreditCards = Stripe.FetchCards();
                app.getView({
                    Basket: cart.object,
                    StripePaymentError: result.message,
     				ApplicableCreditCards: stripeCreditCards,
                    ContinueURL: URLUtils.https('COBilling-Billing')
                }).render('checkout/billing/billing');

            }
            return result;
        } else if (customer.authenticated) {
        	var billingForm = app.getForm('billing').object;
        	var cart = app.getModel('Cart').get();
            var paymentInstrument = cart.getPaymentInstruments(dworder.PaymentInstrument.METHOD_CREDIT_CARD)[0];
        	var result = Stripe.UpdateCard({PaymentInstrument : paymentInstrument, BillingAddress : billingForm.billingAddress});
        	if (result.error) {
                app.getView({
                    Basket: cart.object,
                    StripePaymentError: result,
                    ContinueURL: URLUtils.https('COBilling-Billing')
                }).render('checkout/billing/billing');
        	}
        	return result
        } else {
        	var result = {error:false};
        	return result;
        }
    } else {
    	var result = {error:false};
    	return result;
    }
}

/**
 *  Make new default credit card and saved changes to the stripe customer object
 * @returns
 */
function makeDefault()
{
	if (StripeHelper.IsStripeEnabled()) {
		var cardId = request.httpParameterMap.get("cardId");
		Stripe.MakeDefault(cardId.stringValue);

	    response.redirect(dwweb.URLUtils.https('PaymentInstruments-List'));
	}
}


exports.MakeDefault = guard.ensure(['https', 'get', 'loggedIn'], makeDefault);
exports.AfterSubmitBilling = afterSubmitBilling;
exports.DisplayProductFeed = guard.ensure(['https', 'get'], displayProductFeed);
exports.SelectCreditCard = guard.ensure(['https', 'get'], selectCreditCard);