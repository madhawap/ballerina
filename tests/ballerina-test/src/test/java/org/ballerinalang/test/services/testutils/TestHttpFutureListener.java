/*
 *  Copyright (c) 2017, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 *  WSO2 Inc. licenses this file to you under the Apache License,
 *  Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing,
 *  software distributed under the License is distributed on an
 *  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 *  KIND, either express or implied.  See the License for the
 *  specific language governing permissions and limitations
 *  under the License.
 */
package org.ballerinalang.test.services.testutils;

import org.ballerinalang.connector.api.BallerinaConnectorException;
import org.ballerinalang.connector.api.ConnectorFutureListener;
import org.ballerinalang.model.values.BStruct;
import org.ballerinalang.model.values.BValue;
import org.ballerinalang.net.http.Constants;
import org.ballerinalang.net.http.CorsHeaderGenerator;
import org.ballerinalang.net.http.HttpUtil;
import org.ballerinalang.net.http.session.Session;
import org.ballerinalang.services.ErrorHandlerUtils;
import org.wso2.transport.http.netty.message.HTTPCarbonMessage;

import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * Test future implementation for service tests.
 */
public class TestHttpFutureListener implements ConnectorFutureListener {

    private volatile Semaphore executionWaitSem;
    private HTTPCarbonMessage requestMessage;
    private BValue request;

    private HTTPCarbonMessage responseMsg;
    private int timeOut = 120;

    public TestHttpFutureListener(HTTPCarbonMessage requestMessage) {
        executionWaitSem = new Semaphore(0);
        this.requestMessage = requestMessage;
    }

    @Override
    public void notifySuccess() {
    }

    public void setRequestStruct(BValue request) {
        this.request = request;
    }

    @Override
    public void notifyReply(BValue... response) {
        //TODO check below line
        HTTPCarbonMessage responseMessage = HttpUtil.getCarbonMsg((BStruct) response[0], null);
        Session session = (Session) ((BStruct) request).getNativeData(Constants.HTTP_SESSION);
        if (session != null) {
            session.generateSessionHeader(responseMessage);
        }
        //Process CORS if exists.
        if (requestMessage.getHeader("Origin") != null) {
            CorsHeaderGenerator.process(requestMessage, responseMessage, true);
        }
        this.responseMsg = responseMessage;
        this.executionWaitSem.release();
    }

    @Override
    public void notifyFailure(BallerinaConnectorException ex) {
        Object carbonStatusCode = requestMessage.getProperty(Constants.HTTP_STATUS_CODE);
        int statusCode = (carbonStatusCode == null) ? 500 : Integer.parseInt(carbonStatusCode.toString());
        String errorMsg = ex.getMessage();
        ErrorHandlerUtils.printError(ex);
        this.responseMsg = HttpUtil.createErrorMessage(errorMsg, statusCode);
        this.executionWaitSem.release();
    }

    public void sync() {
        try {
            executionWaitSem.tryAcquire(timeOut, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            //ignore
        }
    }

    public void setResponseMsg(HTTPCarbonMessage httpCarbonMessage) {
        this.responseMsg = httpCarbonMessage;
        executionWaitSem.release();
    }

    public HTTPCarbonMessage getResponseMsg() {
        return responseMsg;
    }
}
