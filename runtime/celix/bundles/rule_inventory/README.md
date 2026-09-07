# Rule inventory probe

`horn::rules` is the first runtime proof that the methodology layer is genuinely dynamic.

The bundle tracks `IHornRule` services through the Celix service registry and lists the services that are present at the moment the command runs. Adding or removing a rule bundle changes the inventory without changing this consumer.

This command does not parse or analyze a Horn document. It exists to prove service discovery before the document adapter is introduced.
