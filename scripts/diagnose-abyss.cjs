const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("正在诊断 DreamSeeker 的归墟逻辑依赖...");

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
    const wishTokenAddr = deployInfo.contracts.WishPowerToken;

    console.log("Configured Seeker:", seekerAddr);
    console.log("Configured Treasury:", treasuryAddr);
    console.log("Configured WishToken:", wishTokenAddr);

    // 1. 读取 Seeker 存储的变量
    // DreamSeeker 实际上使用 storage slot 或 public getter
    // 源码中: IDreamTreasury public treasury; 和 address private wishToken;
    // wishToken 是 private，但也许有 getter? 没有 getter。
    // 但是它在 initialize 中被赋值。
    // 我们可以通过 storage slot 读取 private 变量，或者通过 impersonate 模拟执行 Tier 0 逻辑 (hard on mainnet)。
    // 或者，我们可以尝试调用一个 view function 如果有的话。
    // 遗憾的是 wishToken 是 private 且没有 getter。
    // 但 `getAbyssStats` 函数用到了 `IERC20(wishToken).balanceOf(address(treasury))`

    const seeker = await hre.ethers.getContractAt("DreamSeeker", seekerAddr);

    console.log("正在尝试调用 getAbyssStats()...");
    // 这个函数会执行: poolBalance = IERC20(wishToken).balanceOf(address(treasury));
    // 如果 wishToken 地址错，这个 view function 也会 revert。

    try {
        const stats = await seeker.getAbyssStats();
        console.log("✅ getAbyssStats 调用成功!");
        console.log("Pool Balance:", hre.ethers.formatEther(stats.poolBalance));
        console.log("Total Dividends:", hre.ethers.formatEther(stats.dividendsDistributed));
        console.log("Holder Count:", stats.holderCount.toString());
        console.log("Total Shares:", stats.shares.toString());
        console.log("Abyss Count:", stats.abyssCount.toString());
    } catch (e) {
        console.error("❌ getAbyssStats 调用失败! 这表明 wishToken 或 treasury 配置有误。");
        console.error("错误详情:", e.message);

        // 如果这里失败，我们很确定是 verify 的问题。
        // 我们再尝试单独检查 Treasury
        try {
            const treasury = await seeker.treasury();
            console.log("Seeker.treasury() 返回:", treasury);
            if (treasury.toLowerCase() !== treasuryAddr.toLowerCase()) {
                console.warn("⚠️ Seeker 中存储的 Treasury 地址与部署文件不一致!");
            }
        } catch (e2) {
            console.error("读取 treasury 失败:", e2.message);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
