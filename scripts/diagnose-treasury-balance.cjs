const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("正在检查 DreamTreasury 的 WISH 余额...");

    const network = hre.network.name;
    const deployInfoPath = `deploy/deployment-modular.json`;

    let deployInfo;
    if (fs.existsSync(`deploy/deployment-${network}.json`)) {
        deployInfo = JSON.parse(fs.readFileSync(`deploy/deployment-${network}.json`));
    } else if (fs.existsSync(deployInfoPath)) {
        deployInfo = JSON.parse(fs.readFileSync(deployInfoPath));
    }

    const treasuryAddr = deployInfo.contracts.DreamTreasury;
    const seekerAddr = deployInfo.contracts.DreamSeeker;

    // Get WishToken address from Treasury (on-chain source of truth)
    const treasury = await hre.ethers.getContractAt("DreamTreasury", treasuryAddr);
    const wishTokenAddr = await treasury.wishToken();

    console.log("Treasury Address:", treasuryAddr);
    console.log("WishToken Address:", wishTokenAddr);

    const wishToken = await hre.ethers.getContractAt("IERC20", wishTokenAddr);
    const balance = await wishToken.balanceOf(treasuryAddr);

    console.log("Treasury WISH Balance:", hre.ethers.formatEther(balance));

    if (balance == 0n) {
        console.log("⚠️ Balance is 0. Abyss logic should skip payout. If revert happens, it's NOT in payoutToken.");
    } else {
        console.log("✅ Balance > 0. Payout logic will run.");

        // Check allowance? No, Treasury calls transfer(), not transferFrom(). No allowance needed.
    }

    // Check Configs
    const coreAddr = deployInfo.contracts.CloudDreamCore;
    const core = await hre.ethers.getContractAt("ICloudDreamCore", coreAddr);

    const seekerInCore = await core.seeker();
    console.log("Seeker in Core:", seekerInCore);
    if (seekerInCore.toLowerCase() !== seekerAddr.toLowerCase()) {
        console.error("❌ Core believes Seeker is:", seekerInCore);
    } else {
        console.log("✅ Core configuration matches.");
    }

    const seekerInTreasury = await core.seeker(); // Wait, Treasury onlySeeker checks core.seeker()
    // The modifier is: require(msg.sender == core.seeker())
    // So if Core says seeker is correct, then Treasury will accept expected Seeker.
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
