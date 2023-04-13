var $ = go.GraphObject.make;

// Diagrama que recibirá los nodos y enlaces
var diagram = $(go.Diagram, "divDiagrama",
	{
		// por defecto, la rueda del ratón permite hacer zoom en lugar de scroll
		// si el usuario pulsa el botón central del ratón permite hacer scroll
		//"toolManager.mouseWheelBehavior": go.ToolManager.WheelZoom,
		"allowDrop": true, // se permite soltar objetos
		"undoManager.isEnabled": true, // CTRL+Z && CTRL+Y
		"animationManager.isEnabled": false
	});

// Plantilla para selección de nodo
var plantillaSeleccionNodo =
	$(go.Adornment, "Auto",
		$(go.Shape, { fill: null, stroke: "deepskyblue", strokeWidth: 1.5, strokeDashArray: [4, 2] }), $(go.Placeholder)
	);

// Plantilla para definir un nodo de tipo figura
var plantillaNodoImagen =
	$(go.Node, "Spot",
		new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify), // importante para replicar la información a través del servidor
		// el objeto principal es un panel que contiene un texto debajo de una figura
		$(go.Picture,
			{
				name: "FIGURA",
				desiredSize: new go.Size(64, 64), // tamaño por defecto
				imageStretch: go.GraphObject.Fill,
				margin: 2,

			},
			new go.Binding("source"),
			new go.Binding("desiredSize"))
	);

// Como se hace uso de diferentes plantillas de nodos es necesario guardarlas y asociarlas al diagrama
var plantillasNodos = new go.Map();
plantillasNodos.add("imagen", plantillaNodoImagen);
diagram.nodeTemplateMap = plantillasNodos;

// this predicate is true if both node data keys start with the same letter
function samePrefix(group, node) {
	if (group === null)
		return true;  // when maybe dropping a node in the background
	if (node instanceof go.Group)
		return false;  // don't add Groups to Groups
	return group.data.key.charAt(0) === node.data.key.charAt(0);
};

diagram.mouseDrop = e => {
	// dropping in diagram background removes nodes from any group
	diagram.commandHandler.addTopLevelParts(diagram.selection, true);
};


if (window.screen.width > 2560) {
	initialGroupModelConfiguration(256, 1760, 1280, ["0 -200", "128 500", "384 500", "640 500"]);
} else if (window.screen.width < 1280) {
	initialGroupModelConfiguration(64, 440, 320, ["0 -100", "64 250", "192 250", "320 250"]);
} else {
	initialGroupModelConfiguration(128, 880, 640, ["0 -200", "128 500", "384 500", "640 500"]);
}


function initialGroupModelConfiguration(nodeSize, shapeWidth, shapeHeight, locations) {
	// Plantilla Grupo de elementos
	diagram.groupTemplate =
		$(go.Group, "Vertical",
			{
				// only allow those simple nodes that have the same data key prefix:
				memberValidation: samePrefix,
				// don't need to define handlers on member Nodes and Links
				handlesDragDropForMembers: true,
				// support highlighting of Groups when allowing a drop to add a member
				mouseDragEnter: (e, grp, prev) => {
					// this will call samePrefix; it is true if any node has the same key prefix
					if (grp.canAddMembers(grp.diagram.selection)) {
						var shape = grp.findObject("SHAPE");
						if (shape)
							shape.fill = "lightgreen";
						grp.diagram.currentCursor = "";
					} else {
						var shape = grp.findObject("SHAPE");
						if (shape)
							shape.fill = "red";
						grp.diagram.currentCursor = "not-allowed";
					}
				},
				mouseDragLeave: (e, grp, next) => {
					var shape = grp.findObject("SHAPE");
					if (shape)
						shape.fill = "rgba(239,239,240,1)";
					grp.diagram.currentCursor = "";
				},
				// actually add permitted new members when a drop occurs
				mouseDrop: (e, grp) => {
					if (grp.canAddMembers(grp.diagram.selection)) {
						// this will only add nodes with the same key prefix
						grp.addMembers(grp.diagram.selection, true);
					} else {  // and otherwise cancel the drop
						grp.diagram.currentTool.doCancel();
					}
				}
			},
			// make sure all Groups are behind all regular Nodes
			{ layerName: "Background" },
			new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
			$(go.Shape,
				{
					name: "SHAPE", width: shapeWidth, height: shapeHeight,
					fill: "rgba(239,239,240,1)"
				})
		);

	// El modelo del diagrama se encuentra vacío inicialmente
	diagram.model = $(go.GraphLinksModel,
		{
			linkKeyProperty: "key", // importante para poder compartir la información en un GraphLinksModel
			nodeDataArray: [
				{ key: "Correct", isGroup: true, loc: locations[0] },
				{ key: "Emotion", group: "Correct", source: "images/choice.png", desiredSize: new go.Size(nodeSize * 2, nodeSize * 2), category: "imagen" },
				//{ key: "Emotion", group: "Correct", loc: "350 -200", source: "images/choice.png", desiredSize: new go.Size(256, 256), category: "imagen" },
				{ key: "Incorrect", loc: locations[1], source: "images/happy.png", desiredSize: new go.Size(nodeSize, nodeSize), category: "imagen" },
				{ key: "Correct", loc: locations[2], source: "images/quiet.png", desiredSize: new go.Size(nodeSize, nodeSize), category: "imagen" },
				{ key: "Incorrect", loc: locations[3], source: "images/sad.png", desiredSize: new go.Size(nodeSize, nodeSize), category: "imagen" }
			],
			linkDataArray: []
		}
	);
}


/***
	COMUNICACIÓN CLIENTE-SERVIDOR --- TOGETHERJS ---
***/
diagram.model.addChangedListener(function (e) {
	if (e.isTransactionFinished) {
		var json = e.model.toIncrementalJson(e);

		if (TogetherJS.running) {
			TogetherJS.send({
				type: "content-send",
				output: json
			});
			console.log(json)
		}
	}
});

TogetherJS.hub.on("content-send", function (msg) {
	if (!msg.sameUrl) {
		return;
	}
	diagram.model.applyIncrementalJson(msg.output);
	//diagram.isModified = false;
	console.log(msg.output);
});