/**
 * Copyright (c) 2016, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
define(['lodash', 'd3','log', './simple-statement-view', './../ast/action-invocation-expression', './point', 'd3utils', './../ast/ballerina-ast-factory'],
    function (_, d3, log, SimpleStatementView, ActionInvocationExpression, Point, D3Utils, BallerinaASTFactory) {

        var ActionInvocationStatementView = function (args) {
            SimpleStatementView.call(this, args);
            this._connectorView = {};

            if (_.isNil(this._container)) {
                log.error("Container for action statement is undefined." + this._container);
                throw "Container for action statement is undefined." + this._container;
            }

            this.getBoundingBox().fromTopCenter(this._topCenter, this._viewOptions.width, this._viewOptions.height);
            this._processorConnector = undefined;
            this._processorConnector2 = undefined;
            this._forwardArrowHead = undefined;
            this._backArrowHead = undefined;
            this._arrowGroup = undefined;

        };

        ActionInvocationStatementView.prototype = Object.create(SimpleStatementView.prototype);
        ActionInvocationStatementView.prototype.constructor = ActionInvocationStatementView;


        ActionInvocationStatementView.prototype.init = function(){
            this.getModel().on("drawConnectionForAction",this.drawActionConnections,this);
            Object.getPrototypeOf(this.constructor.prototype).init.call(this);
        };
        ActionInvocationStatementView.prototype.setDiagramRenderingContext = function(context){
            this._diagramRenderingContext = context;
        };
        ActionInvocationStatementView.prototype.getDiagramRenderingContext = function(){
            return this._diagramRenderingContext;
        };

        // TODO : Please revisit this method. Needs a refactor
        ActionInvocationStatementView.prototype.drawActionConnections = function(startPoint){
            // Action invocation model is the child of the right operand
            var actionInvocationModel = this._model.getChildren()[1].getChildren()[0];
            log.debug("Drawing connections for http connector actions");
            // TODO : Please alter this logic
            if(!_.isNil(this.getModel().getConnector())) {
                var connector = this.getDiagramRenderingContext().getViewModelMap()[this.messageManager.getActivatedDropTarget().id];
                actionInvocationModel.setConnector(this.messageManager.getActivatedDropTarget());
                this.renderArrows(this.getDiagramRenderingContext());
            }
        };

        ActionInvocationStatementView.prototype.setModel = function (model) {
            var actionInvocationModel = this._model.getChildren()[1].getChildren()[0];
            if (!_.isNil(model) && model instanceof ActionInvocationExpression) {
                actionInvocationModel = model;
            } else {
                log.error("Action statement definition is undefined or is of different type." + model);
                throw "Action statement definition is undefined or is of different type." + model;
            }
        };

        ActionInvocationStatementView.prototype.setConnectorView = function(view){
            this._connectorView = view;
        };
        ActionInvocationStatementView.prototype.getConnectorView = function(){
            return this._connectorView;
        };


        /**
         * Rendering the view for get-Action statement.
         * @returns {group} The svg group which contains the elements of the action statement view.
         */
        ActionInvocationStatementView.prototype.render = function (renderingContext) {
            var self = this;
            var model = this.getModel();
            // Calling super class's render function.
            (this.__proto__.__proto__).render.call(this, renderingContext);
            // Setting display text.
            this.renderDisplayText(model.getStatementString());

            /* Action invocation statement is generally an assignment statement, where the action invocation model is
             the child of the right operand. */
            var actionInvocationModel = model.getChildren()[1].getChildren()[0];
            var connectorModel = actionInvocationModel.getConnector();
            actionInvocationModel.accept(this);
            if (!_.isUndefined(connectorModel)) {
                this.connector = this.getDiagramRenderingContext().getViewOfModel(connectorModel);
            }
            else {
                var siblingConnectors = this._parent._model.children;
                _.some(siblingConnectors, function (key, i) {
                    if (BallerinaASTFactory.isConnectorDeclaration(siblingConnectors[i])) {
                        var connectorReference = siblingConnectors[i];
                        actionInvocationModel._connector = connectorReference;
                        self.messageManager.setMessageSource(actionInvocationModel);
                        self.messageManager.updateActivatedTarget(connectorReference);
                        return true;
                    }
                });
            }

            this.renderProcessorConnectPoint(renderingContext);
            this.renderArrows(renderingContext);

            // Creating property pane
            var editableProperty = {
                    propertyType: "text",
                    key: "Action Invocation",
                    model: model,
                    getterMethod: model.getStatementString,
                    setterMethod: model.setStatementString
            };

            this._createPropertyPane({
                model: model,
                statementGroup: this.getStatementGroup(),
                editableProperties: editableProperty
            });
            this.listenTo(model, 'update-property-text', this.updateStatementText);

            // mouse events for 'processorConnectPoint'
            this.processorConnectPoint.on("mousedown", function () {
                d3.event.preventDefault();
                d3.event.stopPropagation();
                var x =  parseFloat(self.processorConnectPoint.attr('cx'));
                var y =  parseFloat(self.processorConnectPoint.attr('cy'));
                var sourcePoint = self.toGlobalCoordinates(new Point(x, y));

                self.messageManager.startDrawMessage(actionInvocationModel, sourcePoint);
                self.messageManager.setTypeBeingDragged(true);
            });
            this.processorConnectPoint.on("mouseover", function () {
                self.processorConnectorPoint
                    .style("fill", "#444")
                    .style("fill-opacity", 0.5)
                    .style("cursor", 'url(images/BlackHandwriting.cur), pointer');
            });
            this.processorConnectPoint.on("mouseout", function () {
                self.processorConnectorPoint.style("fill-opacity", 0.01);
            });

            this.getBoundingBox().on('top-edge-moved', function(dy){
                self.processorConnectorPoint.attr('cy',  parseFloat(self.processorConnectorPoint.attr('cy')) + dy);
            });
        };

        ActionInvocationStatementView.prototype.renderArrows = function (context) {
            this.setDiagramRenderingContext(context);
            var actionInvocationModel = this._model.getChildren()[1].getChildren()[0];
            var connectorModel = actionInvocationModel.getConnector();

            if(!_.isUndefined(connectorModel)) {
                this.connector = this.getDiagramRenderingContext().getViewOfModel(connectorModel);
            }

            if(!_.isUndefined(this.connector)) {
                var parent = this.getStatementGroup();
                this._arrowGroup = D3Utils.group(parent).attr("transform", "translate(0,0)");
                var width = this.getBoundingBox().w();
                var height = this.getBoundingBox().h();
                var x = this.getBoundingBox().getLeft();
                var y = this.getBoundingBox().getTop();
                var sourcePointX = x + width;
                var sourcePointY = y + height / 2;

                var startPoint = new Point(sourcePointX, sourcePointY);
                var connectorCenterPointX = this.connector.getMiddleLineCenter().x();
                var connectorCenterPointY = this.connector.getMiddleLineCenter().y();
                var startX = Math.round(startPoint.x());
                this._processorConnector = D3Utils.line(Math.round(startPoint.x()), Math.round(startPoint.y()), Math.round(connectorCenterPointX),
                    Math.round(startPoint.y()), this._arrowGroup).classed("action-line", true);
                this._forwardArrowHead = D3Utils.inputTriangle(Math.round(connectorCenterPointX) - 5, Math.round(startPoint.y()), this._arrowGroup).classed("action-arrow", true);
                this._forwardArrowHead.attr("transform", "translate(0,0)");
                this._processorConnector2 = D3Utils.line(Math.round(startPoint.x()), Math.round(startPoint.y()) + 8, Math.round(connectorCenterPointX),
                    Math.round(startPoint.y()) + 8, this._arrowGroup).classed("action-dash-line", true);
                this._backArrowHead = D3Utils.outputTriangle(Math.round(startPoint.x()), Math.round(startPoint.y()) + 8, this._arrowGroup).classed("action-arrow", true);
                this._backArrowHead.attr("transform", "translate(0,0)");

                this.getBoundingBox().on('right-edge-moved', function (offset) {
                    var currentX1ProcessorConnector = this._processorConnector.attr('x1');
                    var currentX1ProcessorConnector2 = this._processorConnector2.attr('x1');
                    this._processorConnector.attr('x1', parseFloat(currentX1ProcessorConnector) + offset);
                    this._processorConnector2.attr('x1', parseFloat(currentX1ProcessorConnector2) + offset);

                    var backwardArrowTransformX = this._backArrowHead.node().transform.baseVal.consolidate().matrix.e;
                    var backwardArrowTransformY = this._backArrowHead.node().transform.baseVal.consolidate().matrix.f;
                    this._backArrowHead.node().transform.baseVal.getItem(0).setTranslate(backwardArrowTransformX + offset, backwardArrowTransformY + 0);
                }, this);

                this.connector.getBoundingBox().on('moved', function (offset) {
                    var currentX2ProcessorConnector = this._processorConnector.attr('x2');
                    var currentX2ProcessorConnector2 = this._processorConnector2.attr('x2');
                    this._processorConnector.attr('x2', parseFloat(currentX2ProcessorConnector) + offset.dx);
                    this._processorConnector2.attr('x2', parseFloat(currentX2ProcessorConnector2) + offset.dx);

                    var forwardArrowTransformX = this._forwardArrowHead.node().transform.baseVal.consolidate().matrix.e;
                    var forwardArrowTransformY = this._forwardArrowHead.node().transform.baseVal.consolidate().matrix.f;
                    this._forwardArrowHead.node().transform.baseVal.getItem(0).setTranslate(forwardArrowTransformX + offset.dx, forwardArrowTransformY + offset.dy);
                }, this);

                this.processorConnectPoint.style("display", "none");

                var arrowHeadEnd = D3Utils.circle(Math.round(connectorCenterPointX) - 5, Math.round(startPoint.y()), 10, parent);
                arrowHeadEnd
                    .attr("fill-opacity", 0.01)
                    .style("fill", "#444");

                this.arrowHeadEndPoint = arrowHeadEnd;

                var self = this;

                this.arrowHeadEndPoint.on("mousedown", function () {
                    d3.event.preventDefault();
                    d3.event.stopPropagation();

                    var x =  parseFloat(self.arrowHeadEndPoint.attr('cx'));
                    var y =  parseFloat(self.arrowHeadEndPoint.attr('cy'));
                    var x1 =  parseFloat(self._processorConnector.attr('x1'));
                    var y1 =  parseFloat(self._processorConnector.attr('y1'));

                    var sourcePoint = self.toGlobalCoordinates(new Point(x, y));
                    var connectorPoint = self.toGlobalCoordinates(new Point(x1, y1));

                    self.messageManager.startDrawMessage(actionInvocationModel, sourcePoint, connectorPoint);
                    self.messageManager.setTypeBeingDragged(true);

                    self._forwardArrowHead.remove();
                    self._processorConnector.remove();
                    self._processorConnector2.remove();
                    self._backArrowHead.remove();
                    self.arrowHeadEndPoint.remove();
                });

                this.arrowHeadEndPoint.on("mouseover", function () {
                    arrowHeadEnd
                        .style("fill-opacity", 0.5)
                        .style("cursor", 'url(images/BlackHandwriting.cur), pointer');
                });

                this.arrowHeadEndPoint.on("mouseout", function () {
                    arrowHeadEnd.style("fill-opacity", 0.01);
                });
            }
        };

        ActionInvocationStatementView.prototype.renderProcessorConnectPoint = function (renderingContext) {
            var boundingBox = this.getBoundingBox();
            var width = boundingBox.w();
            var height = boundingBox.h();
            var x = boundingBox.getLeft();
            var y = boundingBox.getTop();

            var processorConnectPoint = D3Utils.circle((x + width), ((y + height / 2)), 10, this.getStatementGroup());
            processorConnectPoint.attr("fill-opacity", 0.01);
            this.processorConnectPoint = processorConnectPoint;
        };

        /**
         * Remove the forward and the backward arrow heads
         */
        ActionInvocationStatementView.prototype.removeArrows = function () {
            if (!_.isNil(this._arrowGroup) && !_.isNil(this._arrowGroup.node())) {
                d3.select(this._arrowGroup).node().remove();
            }
        };

        /**
         * Covert a point in user space Coordinates to client viewport Coordinates.
         * @param {Point} point a point in current user coordinate system
         */
        ActionInvocationStatementView.prototype.toGlobalCoordinates = function (point) {
            var pt = this.processorConnectPoint.node().ownerSVGElement.createSVGPoint();
            pt.x = point.x();
            pt.y = point.y();
            pt = pt.matrixTransform(this.processorConnectPoint.node().getCTM());
            return new Point(pt.x, pt.y);
        };

        /**
         * Remove statement view callback
         */
        ActionInvocationStatementView.prototype.onBeforeModelRemove = function () {
            this.stopListening(this.getBoundingBox());
            d3.select("#_" +this._model.id).remove();
            this.getDiagramRenderingContext().getViewOfModel(this._model.getParent()).getStatementContainer()
                .removeInnerDropZone(this._model);
            this.removeArrows();
            // resize the bounding box in order to the other objects to resize
            var moveOffset = -this.getBoundingBox().h() - 30;
            this.getBoundingBox().move(0, moveOffset);

        };

        ActionInvocationStatementView.prototype.updateStatementText = function (newStatementText, propertyKey) {
            this._model.setStatementString(newStatementText);
            var displayText = this._model.getStatementString();
            this.renderDisplayText(displayText);
        };

        return ActionInvocationStatementView;

    });