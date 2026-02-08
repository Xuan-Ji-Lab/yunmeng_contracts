const hre = require("hardhat");

async function main() {
    const FLAP_PORTAL = "0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9"; // Portal
    console.log("Inspecting Portal Vars:", FLAP_PORTAL);

    const abi = [
        "function poolManager() view returns (address)",
        "function swapRouter() view returns (address)",
        "function router() view returns (address)",
        "function positionManager() view returns (address)",
        "function v4Router() view returns (address)",
        "function universalRouter() view returns (address)",
        "function WETH9() view returns (address)",
        "function weth() view returns (address)"
    ];

    const portal = await hre.ethers.getContractAt(abi, FLAP_PORTAL);

    try { console.log("PoolManager:", await portal.poolManager()); } catch (e) {
        // console.log("PoolManager fail");
    }
    try { console.log("SwapRouter:", await portal.swapRouter()); } catch (e) { }
    try { console.log("Router:", await portal.router()); } catch (e) { }
    try { console.log("PositionManager:", await portal.positionManager()); } catch (e) { }
    try { console.log("V4Router:", await portal.v4Router()); } catch (e) { }
    try { console.log("UniversalRouter:", await portal.universalRouter()); } catch (e) { }
    try { console.log("WETH9:", await portal.WETH9()); } catch (e) { }
}

main().catch(console.error);
