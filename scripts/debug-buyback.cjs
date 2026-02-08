const hre = require("hardhat");

async function main() {
    const TREASURY = "0xf261e933e404427c81fb4e8D936772b113BC03Ea";
    const [deployer] = await hre.ethers.getSigners();

    console.log(`Debugging Buyback on ${TREASURY}...`);

    const treasury = await hre.ethers.getContractAt("DreamTreasury", TREASURY);

    // Simulate call
    // executeBuyback is not view, but we can callStatic it
    try {
        await treasury.executeBuyback.staticCall(0); // 0 = all
        console.log("✅ Simulation Success!");
    } catch (e) {
        console.log("❌ Simulation Failed");
        if (e.data) {
            console.log("Revert Data:", e.data);
            // Try to decode common errors
            try {
                const reason = hre.ethers.toUtf8String("0x" + e.data.slice(138));
                console.log("Decoded String:", reason);
            } catch { }
            try {
                const iface = new hre.ethers.Interface(["error Error(string)"]);
                const decoded = iface.parseError(e.data);
                console.log("Decoded Error:", decoded);
            } catch { }
        } else {
            console.log("Message:", e.message);
        }
    }
}

main().catch(console.error);
