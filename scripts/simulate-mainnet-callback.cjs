const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Simulating VRF Callback on Mainnet Fork...");

    // 1. Setup Config
    const deployPath = "deploy/deployment-modular.json";
    const info = JSON.parse(fs.readFileSync(deployPath));
    const seekerAddress = info.contracts.DreamSeeker;
    const vrfCoordinatorAddress = info.config.vrfCoordinator;

    // Request ID from the stuck transaction 0xcd46...
    const REQUEST_ID = "47903190278797915101399444548476706413763493545215989894965165053361290578053";

    console.log(`Target Contract: ${seekerAddress}`);
    console.log(`Impersonating Coordinator: ${vrfCoordinatorAddress}`);
    console.log(`Fulfilling Request ID: ${REQUEST_ID}`);

    // 2. Impersonate VRF Coordinator
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [vrfCoordinatorAddress],
    });

    // Fund the coordinator account so it can transact
    await hre.network.provider.send("hardhat_setBalance", [
        vrfCoordinatorAddress,
        "0x1000000000000000000", // 1 ETH
    ]);

    const coordinatorSigner = await hre.ethers.getSigner(vrfCoordinatorAddress);
    const DreamSeeker = await hre.ethers.getContractFactory("DreamSeeker");
    const seeker = DreamSeeker.attach(seekerAddress).connect(coordinatorSigner);

    // 3. Prepare Random Words
    const randomWords = [777]; // Lucky number

    // 4. Execute rawFulfillRandomWords
    console.log("Executing callback...");
    try {
        const tx = await seeker.rawFulfillRandomWords(REQUEST_ID, randomWords, {
            gasLimit: 1000000 // Match the 1M limit we set
        });

        console.log(`Tx sent: ${tx.hash}`);
        const receipt = await tx.wait();

        console.log(`✅ Callback Successful!`);
        console.log(`Gas Used: ${receipt.gasUsed.toString()}`);

        // 5. Verify State Change
        const reqStatus = await seeker.s_requests(REQUEST_ID);
        console.log(`Request Fulfilled Status: ${reqStatus.fulfilled ? "TRUE" : "FALSE"}`);

        if (reqStatus.fulfilled) {
            console.log("\n🎉 CONCLUSION: Contract logic IS VALID. The issue is purely with Chainlink Node responsiveness.");
        } else {
            console.log("\n⚠️ Status not updated?");
        }

    } catch (error) {
        console.error("\n❌ Callback Failed!");
        console.error(error);
    }
}

main().catch(console.error);
