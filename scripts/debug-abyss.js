const hre = require("hardhat");
const deploymentInfo = require('../deploy/deployment-modular.json');

async function main() {
    const provider = new hre.ethers.JsonRpcProvider("https://bsc-testnet.publicnode.com");

    const seekerAddress = deploymentInfo.contracts.DreamSeeker;
    const treasuryAddress = deploymentInfo.contracts.DreamTreasury;
    const tokenAddress = deploymentInfo.contracts.WishPowerToken;

    console.log("=== 归墟分红验证脚本 ===");
    console.log("Seeker:", seekerAddress);
    console.log("Treasury:", treasuryAddress);
    console.log("Token:", tokenAddress);

    // 1. 查询当前 Treasury 的 WISH 代币余额
    const token = new hre.ethers.Contract(tokenAddress, [
        "function balanceOf(address) view returns (uint256)",
        "function totalSupply() view returns (uint256)"
    ], provider);

    const treasuryBalance = await token.balanceOf(treasuryAddress);
    const totalSupply = await token.totalSupply();
    console.log("\n--- Token Info ---");
    console.log("Treasury WISH Balance:", hre.ethers.formatEther(treasuryBalance));
    console.log("Total Supply:", hre.ethers.formatEther(totalSupply));

    // 2. 检查 PayoutFailed 事件
    const seeker = new hre.ethers.Contract(seekerAddress, [
        "event PayoutFailed(address indexed user, uint256 amount, string reason)",
        "event DividendDistributed(address indexed holder, uint256 amount, uint256 shares, uint256 round, uint256 pool)",
        "event AbyssTriggered(address indexed user, bool isGrandFinale, uint256 tribulationCount)",
        "function abyssWinnerRatio() view returns (uint256)",
        "function abyssDividendRatio() view returns (uint256)",
        "function totalAbyssShares() view returns (uint256)",
        "function totalAbyssHolders() view returns (uint256)",
        "function totalAbyssTribulations() view returns (uint256)",
        "function totalDividendsDistributed() view returns (uint256)"
    ], provider);

    // 3. 查询配置
    const [winnerRatio, dividendRatio, totalShares, totalHolders, totalTribs, totalDivDist] = await Promise.all([
        seeker.abyssWinnerRatio(),
        seeker.abyssDividendRatio(),
        seeker.totalAbyssShares(),
        seeker.totalAbyssHolders(),
        seeker.totalAbyssTribulations(),
        seeker.totalDividendsDistributed()
    ]);

    console.log("\n--- Abyss Config ---");
    console.log("Winner Ratio:", Number(winnerRatio), "%");
    console.log("Dividend Ratio:", Number(dividendRatio), "%");
    console.log("Remaining:", 100 - Number(winnerRatio) - Number(dividendRatio), "% stays in treasury");
    console.log("Total Abyss Shares:", Number(totalShares));
    console.log("Total Abyss Holders:", Number(totalHolders));
    console.log("Total Tribulations:", Number(totalTribs));
    console.log("Total Dividends Distributed:", hre.ethers.formatEther(totalDivDist));

    // 4. 查询最近的事件
    console.log("\n--- Recent Events (last 5000 blocks) ---");
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 5000);

    // PayoutFailed
    const failedFilter = seeker.filters.PayoutFailed();
    const failedEvents = await seeker.queryFilter(failedFilter, fromBlock);
    console.log("\nPayoutFailed events:", failedEvents.length);
    for (const e of failedEvents) {
        console.log(`  FAILED: user=${e.args[0]}, amount=${hre.ethers.formatEther(e.args[1])}, reason=${e.args[2]}`);
    }

    // DividendDistributed
    const divFilter = seeker.filters.DividendDistributed();
    const divEvents = await seeker.queryFilter(divFilter, fromBlock);
    console.log("\nDividendDistributed events:", divEvents.length);
    for (const e of divEvents) {
        console.log(`  DIVIDEND: holder=${e.args[0]}, amount=${hre.ethers.formatEther(e.args[1])}, shares=${e.args[2]}, round=${e.args[3]}, pool=${hre.ethers.formatEther(e.args[4])}`);
    }

    // AbyssTriggered
    const abyssFilter = seeker.filters.AbyssTriggered();
    const abyssEvents = await seeker.queryFilter(abyssFilter, fromBlock);
    console.log("\nAbyssTriggered events:", abyssEvents.length);
    for (const e of abyssEvents) {
        console.log(`  ABYSS: user=${e.args[0]}, isGrandFinale=${e.args[1]}, count=${e.args[2]}`);
    }

    // 5. 检查 Treasury 合约的 payoutToken 是否有 approve 权限
    const treasuryContract = new hre.ethers.Contract(treasuryAddress, [
        "function owner() view returns (address)",
    ], provider);

    try {
        const owner = await treasuryContract.owner();
        console.log("\n--- Treasury Info ---");
        console.log("Treasury Owner:", owner);
    } catch (e) {
        console.log("\nTreasury owner() failed:", e.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
