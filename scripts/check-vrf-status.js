/**
 * 检查 VRF 配置参数
 */
const hre = require("hardhat");
const d = require('../deploy/deployment-modular.json');

async function main() {
    const core = await hre.ethers.getContractAt("CloudDreamCore", d.contracts.CloudDreamCore);

    const subId = await core.vrfSubscriptionId();
    const gasLimit = await core.vrfCallbackGasLimit();
    const confirmations = await core.vrfRequestConfirmations();
    const keyHash = await core.vrfKeyHash();

    console.log("📊 VRF 配置:");
    console.log("  Subscription ID:", subId.toString());
    console.log("  Callback Gas Limit:", gasLimit.toString());
    console.log("  Request Confirmations:", confirmations.toString());
    console.log("  Key Hash:", keyHash);

    // 检查 seeker 上的 pending requests
    const seeker = await hre.ethers.getContractAt("DreamSeeker", d.contracts.DreamSeeker);
    const reqId = "53596719053542407476419891192452689268757828104460597199702413487240155707148";
    const req = await seeker.s_requests(reqId);
    console.log("\n📡 Pending VRF Request:");
    console.log("  exists:", req.exists);
    console.log("  fulfilled:", req.fulfilled);

    // 检查 Treasury 余额
    const treasury = d.contracts.DreamTreasury;
    const balance = await hre.ethers.provider.getBalance(treasury);
    console.log("\n💰 Treasury BNB 余额:", hre.ethers.formatEther(balance));

    // 检查 abyssHolder 数量
    const totalAbyssHolders = await seeker.totalAbyssHolders();
    console.log("👥 当前归墟持有者:", totalAbyssHolders.toString());
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
