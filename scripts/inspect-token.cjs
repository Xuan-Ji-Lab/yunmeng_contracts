const hre = require("hardhat");

async function main() {
    const WISH_TOKEN = "0x00050c0d05b0f852c44aef369f188764fd417777";
    console.log("Analyzing Token:", WISH_TOKEN);

    // 标准 ERC20 + 常见 Ownership/Factory
    const abi = [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function owner() view returns (address)",
        "function factory() view returns (address)",
        "function creator() view returns (address)",
        "function portal() view returns (address)",
        "function bondingCurve() view returns (address)"
    ];

    const token = await hre.ethers.getContractAt(abi, WISH_TOKEN);

    try { console.log("Name:", await token.name()); } catch { }
    try { console.log("Symbol:", await token.symbol()); } catch { }
    try { console.log("Decimals:", await token.decimals()); } catch { }

    console.log("\nTrying to find relations:");
    try { console.log("Owner:", await token.owner()); } catch (e) { console.log("Owner: (not found)"); }
    try { console.log("Factory:", await token.factory()); } catch (e) { console.log("Factory: (not found)"); }
    try { console.log("Creator:", await token.creator()); } catch (e) { console.log("Creator: (not found)"); }
    try { console.log("Portal:", await token.portal()); } catch (e) { console.log("Portal: (not found)"); }
    try { console.log("BondingCurve:", await token.bondingCurve()); } catch (e) { console.log("BondingCurve: (not found)"); }
}

main().catch(console.error);
