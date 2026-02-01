const hre = require("hardhat");

const VRF_COORDINATOR = "0x6A2AAd07396B36Fe02a22b33cf443582f682c82f"; // v2
const SUBSCRIPTION_ID = "3565";
const CONTRACT_ADDRESS = "0xe066200ae4cE989325208F4b1cc78B963Ef76644"; // Latest v2 contract

const COORDINATOR_ABI = [
    "function getSubscription(uint64 subId) view returns (uint96 balance, uint64 reqCount, address owner, address[] consumers)"
];

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`\n🔍 Verifying VRF v2 Setup`);
    console.log(`   Contract: ${CONTRACT_ADDRESS}`);
    console.log(`   Sub ID: ${SUBSCRIPTION_ID}`);

    // 1. Check Subscription
    console.log("\n📡 Checking Subscription on v2 Coordinator...");
    const coordinator = new hre.ethers.Contract(VRF_COORDINATOR, COORDINATOR_ABI, deployer);

    try {
        const sub = await coordinator.getSubscription(SUBSCRIPTION_ID);
        console.log(`✅ Subscription Found!`);
        console.log(`   Balance: ${hre.ethers.formatEther(sub.balance)} LINK`);
        console.log(`   Consumers: ${sub.consumers.length}`);

        const isConsumer = sub.consumers.map(c => c.toLowerCase()).includes(CONTRACT_ADDRESS.toLowerCase());

        if (isConsumer) {
            console.log(`✅ Contract IS a registered consumer.`);
        } else {
            console.error(`❌ Contract is NOT in the consumers list!`);
            console.log(`   List:`, sub.consumers);
            return;
        }

        if (sub.balance === 0n) {
            console.error("❌ Subscription Balance is 0 LINK! Please Fund it.");
            return;
        }

    } catch (e) {
        console.error("❌ getSubscription Failed:", e.message);
        return;
    }

    // 2. Simulate Transaction
    console.log("\n⚡ Simulating seekTruth execution...");
    const CloudDreamProtocol = await hre.ethers.getContractFactory("CloudDreamProtocol");
    const protocol = CloudDreamProtocol.attach(CONTRACT_ADDRESS);

    try {
        const gas = await protocol.seekTruth.estimateGas("Verification Test", {
            value: hre.ethers.parseEther("0.001")
        });
        console.log(`✅ Simulation Successful! Gas: ${gas.toString()}`);
        console.log("🚀 The contract is working perfectly on-chain.");
        console.log("👉 If frontend fails, please HARD REFRESH (Clear Cache).");
    } catch (e) {
        console.error(`❌ Simulation Failed!`);
        console.log(e.message);
        if (e.data) console.log("Data:", e.data);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
