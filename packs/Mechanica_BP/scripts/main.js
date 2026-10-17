// Mechanica — Create-style kinetics, automation and self-developing colonists for Minecraft Bedrock.
import { world, BlockPermutation } from "@minecraft/server";
import { NS, provideBlockPermutation } from "./common.js";
import { kineticComponent, startKinetics } from "./kinetics.js";
import { handleLinkClick } from "./automation.js";
import { startCiv } from "./civ.js";

provideBlockPermutation(BlockPermutation);

world.beforeEvents.worldInitialize.subscribe((ev) => {
  ev.blockComponentRegistry.registerCustomComponent(`${NS}:kinetic`, kineticComponent);
});

// wrench linking for logistics nodes: second click on any container
try {
  world.afterEvents.playerInteractWithBlock.subscribe((ev) => {
    if (!ev.block || !ev.player) return;
    handleLinkClick(ev.player, ev.block);
  });
} catch (e) {
  console.warn(`[mech] playerInteractWithBlock unavailable: ${e}`);
}

startKinetics();
startCiv();
console.warn("[mech] Mechanica loaded");
