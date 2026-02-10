const hre = require("hardhat");
const deploymentInfo = require('../deploy/deployment-modular.json');

async function main() {
    const provider = new hre.ethers.JsonRpcProvider("https://bsc-testnet.publicnode.com");

    const seekerAddress = deploymentInfo.contracts.DreamSeeker;
    const batchReaderAddress = deploymentInfo.contracts.CloudDreamBatchReader;

    console.log("Seeker:", seekerAddress);
    console.log("BatchReader:", batchReaderAddress);

    // 1. 直接查询 DreamSeeker 的 allDividendRecords
    const seeker = new hre.ethers.Contract(seekerAddress, [
        "function allDividendRecords(uint256 id) view returns (uint256 id_, address user, uint256 amount, uint256 shares, uint256 round, uint256 pool, uint256 timestamp)",
        "function getUserDividendIds(address user) view returns (uint256[])"
    ], provider);

    // 查询用户地址 - 使用部署者地址或指定地址
    const [deployer] = await hre.ethers.getSigners();
    const userAddress = deployer.address;
    console.log("\n--- Querying User:", userAddress, "---");

    // 获取用户的分红ID列表
    try {
        const ids = await seeker.getUserDividendIds(userAddress);
        console.log("User Dividend IDs:", ids.map(id => Number(id)));

        if (ids.length > 0) {
            // 查询每条记录
            for (let i = 0; i < ids.length; i++) {
                const record = await seeker.allDividendRecords(ids[i]);
                console.log(`\n--- Record ${Number(ids[i])} ---`);
                console.log("  id:", Number(record[0]));
                console.log("  user:", record[1]);
                console.log("  amount (raw):", record[2].toString());
                console.log("  amount (ETH):", hre.ethers.formatEther(record[2]));
                console.log("  shares (raw):", record[3].toString());
                console.log("  round:", Number(record[4]));
                console.log("  pool (raw):", record[5].toString());
                console.log("  pool (ETH):", hre.ethers.formatEther(record[5]));
                console.log("  timestamp:", Number(record[6]), "->", new Date(Number(record[6]) * 1000).toISOString());
            }
        }
    } catch (e) {
        console.error("Direct Seeker query failed:", e.message);
    }

    // 2. 通过 BatchReader 查询
    const batchReader = new hre.ethers.Contract(batchReaderAddress, [
        "function getUserDividendIdsBatch(address user, uint256 start, uint256 count) view returns (uint256[])",
        "function getDividendRecordsBatch(uint256[] ids) view returns (tuple(uint256 id, address user, uint256 amount, uint256 shares, uint256 round, uint256 pool, uint256 timestamp)[])"
    ], provider);

    try {
        const batchIds = await batchReader.getUserDividendIdsBatch(userAddress, 0, 1000);
        console.log("\n--- BatchReader IDs:", batchIds.map(id => Number(id)), "---");

        if (batchIds.length > 0) {
            const records = await batchReader.getDividendRecordsBatch(batchIds);
            console.log("BatchReader Records Count:", records.length);

            for (let i = 0; i < records.length; i++) {
                const d = records[i];
                console.log(`\n--- BatchReader Record ${i} ---`);
                console.log("  d[0] (id):", Number(d[0]));
                console.log("  d[1] (user):", d[1]);
                console.log("  d[2] (amount raw):", d[2].toString());
                console.log("  d[2] (amount ETH):", hre.ethers.formatEther(d[2]));
                console.log("  d[3] (shares):", d[3].toString());
                console.log("  d[4] (round):", Number(d[4]));
                console.log("  d[5] (pool raw):", d[5].toString());
                console.log("  d[6] (timestamp):", Number(d[6]));
            }
        }
    } catch (e) {
        console.error("BatchReader query failed:", e.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
