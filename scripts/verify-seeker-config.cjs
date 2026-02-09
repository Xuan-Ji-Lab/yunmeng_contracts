const hre = require("hardhat");
const fs = require("fs");

/**
 * 验证新 Seeker 配置
 */

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    const deploymentPath = "./deploy/deployment-modular.json";
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    const seeker = await hre.ethers.getContractAt("DreamSeeker", deploymentInfo.contracts.DreamSeeker, deployer);
    const token = await hre.ethers.getContractAt("IERC20", deploymentInfo.contracts.WishPowerToken, deployer);

    console.log("=== 新 DreamSeeker 配置验证 ===");
    console.log("地址:", deploymentInfo.contracts.DreamSeeker);

    const seekCost = await seeker.seekCost();
    console.log("\nseekCost:", hre.ethers.formatEther(seekCost), "BNB");

    const t0 = await seeker.tierThresholds(0);
    const t1 = await seeker.tierThresholds(1);
    const t2 = await seeker.tierThresholds(2);
    const t3 = await seeker.tierThresholds(3);
    console.log("tierThresholds:", [t0, t1, t2, t3].join(", "));

    const pityThreshold = await seeker.pityThreshold();
    console.log("pityThreshold:", pityThreshold.toString());

    // 检查 Treasury 余额
    const treasuryBal = await token.balanceOf(deploymentInfo.contracts.DreamTreasury);
    console.log("\nTreasury WISH 余额:", hre.ethers.formatEther(treasuryBal));

    // 检查用户余额
    const myBal = await token.balanceOf(deployer.address);
    console.log("我的 WISH 余额:", hre.ethers.formatEther(myBal));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
