const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("正在诊断归墟逻辑依赖及Holder数量...");

    const network = hre.network.name;
    const deployInfoPath = `deploy/deployment-modular.json`;

    let deployInfo;
    if (fs.existsSync(`deploy/deployment-${network}.json`)) {
        deployInfo = JSON.parse(fs.readFileSync(`deploy/deployment-${network}.json`));
    } else if (fs.existsSync(deployInfoPath)) {
        deployInfo = JSON.parse(fs.readFileSync(deployInfoPath));
    }

    const seekerAddr = deployInfo.contracts.DreamSeeker;
    const treasuryAddr = deployInfo.contracts.DreamTreasury;

    const seeker = await hre.ethers.getContractAt("DreamSeeker", seekerAddr);
    const treasury = await hre.ethers.getContractAt("DreamTreasury", treasuryAddr);

    // 1. Check WishToken in Treasury
    const wishTokenAddr = await treasury.wishToken();
    console.log("Treasury WishToken:", wishTokenAddr);

    // Check if it's a contract
    const code = await hre.ethers.provider.getCode(wishTokenAddr);
    if (code === "0x") {
        console.error("❌ WishToken is NOT a contract!");
    } else {
        console.log("✅ WishToken is a contract.");
    }

    // 2. Check Abyss Holder List Length
    // The list is public: address[] public abyssHolderList;
    // We can't get length directly from public array getter in some ethers versions easily without loop or custom call, 
    // but `getAbyssStats` returns `holderCount`.

    try {
        const stats = await seeker.getAbyssStats();
        const count = stats.holderCount;
        console.log("Abyss Holder Count (from stats):", count.toString());

        // Also verify with array length if possible (manual call)
        // or just trust stats which uses totalAbyssHolders.
        // Let's call getAbyssHolders() to see if it reverts (too big)

        try {
            const list = await seeker.getAbyssHolders();
            console.log("Abyss Holder List Length (actual):", list.length);
            // console.log("Holders:", list);
        } catch (e) {
            console.warn("⚠️ Cannot retrieve full holder list (might be too huge):", e.message);
        }

        if (count > 50) { // arbitrary warning threshold
            console.warn("⚠️ WARNING: Holder count is high! Iteration in VRF might OOG.");
            // 2M gas / 50 users = 40k gas per user. 
            // Transfer + overhead might be ~15k-30k. 
            // 50 users is safe-ish. 100 users might be risky.
        }

    } catch (e) {
        console.error("❌ call failed:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
