const hre = require("hardhat");

const VRF_COORDINATOR = "0xda3b641d438362c440ac5458c57e00e716446700";
const SUBSCRIPTION_ID = "101402579087029989712199740063898940699041027575169020192445874978090255507241";
const CONTRACT_ADDRESS = "0xd45B2f3aa3AB8417B5Ab932aE342d34cc46566a9";

const COORDINATOR_ABI = [
    "function getSubscription(uint256 subId) view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address owner, address[] consumers)",
    "function owner() view returns (address)"
];

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`\n🔍 Diagnosis Start | RPC: ${hre.network.config.url}`);

    // 1. Check Coordinator Code
    console.log(`\n📡 Checking Coordinator Address: ${VRF_COORDINATOR}`);
    const code = await hre.ethers.provider.getCode(VRF_COORDINATOR);
    if (code === "0x") {
        console.error("❌ CRITICAL: No code at Coordinator address! RPC is wrong or address is wrong for this chain.");
        return;
    }
    console.log("✅ Coordinator Code Exists.");

    // 2. Check Subscription
    const coordinator = new hre.ethers.Contract(VRF_COORDINATOR, COORDINATOR_ABI, deployer);
    console.log(`\n🎫 querying getSubscription(${SUBSCRIPTION_ID})...`);

    try {
        // Force BigInt
        const subIdBN = BigInt(SUBSCRIPTION_ID);
        const sub = await coordinator.getSubscription(subIdBN);

        console.log(`✅ Subscription Found!`);
        console.log(`   Owner: ${sub.owner}`);
        console.log(`   Consumers: ${sub.consumers}`);

        const isConsumer = sub.consumers.map(c => c.toLowerCase()).includes(CONTRACT_ADDRESS.toLowerCase());
        if (isConsumer) {
            console.log(`✅ Target Contract IS a consumer.`);
        } else {
            console.error(`❌ Target Contract is NOT a consumer.`);
            console.log("Please Add:", CONTRACT_ADDRESS);
        }

    } catch (e) {
        console.error("❌ getSubscription Failed!");
        console.log("Error:", e.message);
        // If message is empty/revert, it means ID not found
        if (e.message.includes("reverted") || e.message.includes("could not decode")) {
            console.error("⚠️  Likely cause: Subscription ID does not exist on this Coordinator.");
        }
    }

    // 3. Simulate Transaction
    console.log("\n⚡ Simulating seekTruth execution...");
    const CloudDreamProtocol = await hre.ethers.getContractFactory("CloudDreamProtocol");
    const protocol = CloudDreamProtocol.attach(CONTRACT_ADDRESS);

    try {
        const gas = await protocol.seekTruth.estimateGas("Verification Test", {
            value: hre.ethers.parseEther("0.001")
        });
        console.log(`✅ Simulation Successful! Gas: ${gas.toString()}`);
    } catch (e) {
        console.error(`❌ Simulation Failed!`);
        console.log(e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
