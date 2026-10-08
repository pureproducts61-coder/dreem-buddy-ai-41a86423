
- World Foundation lives in src/services/world (contracts, control, world): provider knowledge only via registered Discoverer/Inspector plugins, Control decides before any InteractionRequest, and requests are recorded but never executed until the TDEF step — keeps Brain/Control/TDEF separated per the master blueprint.
