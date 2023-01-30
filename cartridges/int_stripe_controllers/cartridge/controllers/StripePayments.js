/* eslint-disable new-cap */
/* global response, request */
// v1

'use strict';

var URLUtils = require('dw/web/URLUtils');
var stripePaymentsHelper = require('*/cartridge/scripts/stripe/helpers/controllers/stripePaymentsHelper');
var CSRFProtection = require('dw/web/CSRFProtection');
var app = require('*/cartridge/scripts/app');

/**
 * Entry point for handling payment intent creation and confirmation AJAX calls.
 */
function beforePaymentAuthorization() {
    var responsePayload;
    if (!CSRFProtection.validateRequest()) {
        app.getModel('Customer').logout();
        responsePayload = {
            redirectUrl: URLUtils.url('Home-Show').toString()
        };
        response.setStatus(500);
    } else {
        var isInitial = (request.httpParameterMap.isinitial && request.httpParameterMap.isinitial.value) ? request.httpParameterMap.isinitial.value : false;
        responsePayload = stripePaymentsHelper.BeforePaymentAuthorization(isInitial);
    }

    var jsonResponse = JSON.stringify(responsePayload);
    response.setContentType('application/json');
    response.writer.print(jsonResponse);
}

exports.BeforePaymentAuthorization = beforePaymentAuthorization;
exports.BeforePaymentAuthorization.public = true;

/**
 * An entry point to handle returns from alternative payment methods.
 */
function handleAPM() {
    var redirectUrl = stripePaymentsHelper.HandleAPM();

    response.redirect(redirectUrl);
}

exports.HandleAPM = handleAPM;
exports.HandleAPM.public = true;

/**
 * Entry point for creating payment intent for APMs.
 */
function beforePaymentSubmit() {
    var responsePayload;
    if (!CSRFProtection.validateRequest()) {
        app.getModel('Customer').logout();
        responsePayload = {
            redirectUrl: URLUtils.url('Home-Show').toString()
        };
        response.setStatus(500);
    } else {
        var type = request.httpParameterMap.type.stringValue;
        var params = {};

        if (request.httpParameterMap.orderid && request.httpParameterMap.orderid.value) {
            params.orderid = request.httpParameterMap.orderid.value;
        }
        responsePayload = stripePaymentsHelper.BeforePaymentSubmit(type, params);
    }

    var jsonResponse = JSON.stringify(responsePayload);
    response.setContentType('application/json');
    response.writer.print(jsonResponse);
}

exports.BeforePaymentSubmit = beforePaymentSubmit;
exports.BeforePaymentSubmit.public = true;

/**
 * Entry point for writing errors to Stripe Logger
 */
function logStripeErrorMessage() {
    if (!CSRFProtection.validateRequest()) {
        app.getModel('Customer').logout();
        response.setStatus(500);
    } else {
        var msg = request.httpParameterMap.msg.stringValue;

        stripePaymentsHelper.LogStripeErrorMessage(msg);
    }

    var jsonResponse = JSON.stringify({
        success: true
    });
    response.setContentType('application/json');
    response.writer.print(jsonResponse);
}

exports.LogStripeErrorMessage = logStripeErrorMessage;
exports.LogStripeErrorMessage.public = true;

/**
 * Entry point for fail Stripe order
 */
function failOrder() {
    if (!CSRFProtection.validateRequest()) {
        app.getModel('Customer').logout();
        response.setStatus(500);
    } else {
        stripePaymentsHelper.FailOrder();
    }

    var jsonResponse = JSON.stringify({
        success: true
    });
    response.setContentType('application/json');
    response.writer.print(jsonResponse);
}

exports.FailOrder = failOrder;
exports.FailOrder.public = true;
