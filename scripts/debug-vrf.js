const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const contractAddress = "0xd45B2f3aa3AB8417B5Ab932aE342d34cc46566a9"; // Latest Contract

    console.log("Debugging CloudDreamProtocol at:", contractAddress);

    // Attach contract
    const CloudDreamProtocol = await hre.ethers.getContractFactory("CloudDreamProtocol");
    const protocol = CloudDreamProtocol.attach(contractAddress);

    // 1. Check Configuration
    console.log("\n1. Checking Configuration...");

    try {
        const subId = await protocol.s_subscriptionId();
        console.log("Subscription ID:", subId.toString());

        const keyHash = await protocol.keyHash();
        console.log("Key Hash:", keyHash);

        const coord = await protocol.s_vrfCoordinator();
        console.log("VRF Coordinator:", coord);

        const gasLimit = await protocol.callbackGasLimit();
        console.log("Callback Gas Limit:", gasLimit.toString());

        const treasury = await protocol.treasury();
        console.log("Treasury:", treasury);

    } catch (e) {
        console.log("Failed to read config:", e.message);
    }

    // 2. Simulate Call
    console.log("\n2. Simulating seekTruth...");
    try {
        const gas = await protocol.seekTruth.estimateGas("Debug", {
            value: hre.ethers.parseEther("0.001")
        });
        console.log("✅ Gas Estimation Successful:", gas.toString());
    } catch (e) {
        console.log("❌ Gas Estimation Failed!");
        console.log("Reason:", e.reason);
        console.log("Message:", e.message);
        if (e.data) {
            console.log("Data:", e.data);
            // Try to decode error
            try {
                const decoded = protocol.interface.parseError(e.data);
                console.log("Decoded Error:", decoded);
            } catch {
                console.log("Could not decode error data");
            }
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
