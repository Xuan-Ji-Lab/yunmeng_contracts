const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("Simulating VRF Callback on Mainnet Fork...");

    // 0. Fork Mainnet Explicitly with specific RPC
    // Trying LlamaRPC which is often good for archival/forking
    const MAINNET_RPC = "https://binance.llamarpc.com";

    console.log(`Resetting network to fork ${MAINNET_RPC}...`);
    await hre.network.provider.request({
        method: "hardhat_reset",
        params: [
            {
                forking: {
                    jsonRpcUrl: MAINNET_RPC,
                },
            },
        ],
    });
    console.log("Fork ready.");

    // 1. Setup Config
    const deployPath = "deploy/deployment-modular.json";
    if (!fs.existsSync(deployPath)) {
        throw new Error("Deployment file not found at " + deployPath);
    }
    const info = JSON.parse(fs.readFileSync(deployPath));
    const seekerAddress = info.contracts.DreamSeeker;
    const coordinatorAddress = info.config.vrfCoordinator;

    // The Request ID from previous check
    const REQUEST_ID = "114435887916774903688075172810410046366555938025920826054281412160318151721872";

    console.log(`Seeker: ${seekerAddress}`);
    console.log(`Coordinator: ${coordinatorAddress}`);
    console.log(`Request ID: ${REQUEST_ID}`);

    // 2. Impersonate Coordinator
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [coordinatorAddress],
    });

    // Fund the coordinator so it can send txs
    await hre.network.provider.send("hardhat_setBalance", [
        coordinatorAddress,
        "0x1000000000000000000", // 1 ETH
    ]);

    const coordinatorSigner = await hre.ethers.getSigner(coordinatorAddress);

    // 3. Attach Seeker
    const DreamSeeker = await hre.ethers.getContractFactory("DreamSeeker");
    const seeker = DreamSeeker.attach(seekerAddress).connect(coordinatorSigner);

    // 4. Prepare Random Words
    // Check if request exists
    const reqStatus = await seeker.s_requests(REQUEST_ID);
    console.log(`Request Exists: ${reqStatus.exists}`);
    console.log(`Batch Size: ${reqStatus.batchSize}`);

    if (!reqStatus.exists) {
        console.error("Request not found in this fork! Ensure the RPC node is synced.");
        return;
    }

    const randomWords = [];
    // Just generate some deterministic random words for testing
    for (let i = 0; i < reqStatus.batchSize; i++) {
        const randomWord = hre.ethers.hexlify(hre.ethers.randomBytes(32));
        randomWords.push(randomWord);
    }

    console.log(`Generated ${randomWords.length} random words.`);

    // 5. Simulate Call
    console.log("Calling rawFulfillRandomWords...");
    try {
        // rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords)
        const tx = await seeker.rawFulfillRandomWords(REQUEST_ID, randomWords, {
            gasLimit: 3000000 // Give it plenty of gas to succeed if logic is correct
        });

        console.log(`Tx sent: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`✅ Simulation Successful! Gas Used: ${receipt.gasUsed.toString()}`);

        // Find events
        for (const log of receipt.logs) {
            try {
                const parsed = seeker.interface.parseLog(log);
                if (parsed.name === "SeekResult") {
                    console.log(`Saved Wish: ${parsed.args.wishText} | Tier: ${parsed.args.tier}`);
                }
            } catch (e) { }
        }
    } catch (error) {
        console.error("❌ Simulation FAILED!");
        if (error.data) {
            console.error(`Revert Data: ${error.data}`);
        }
        // Try to decode error
        try {
            // Replay with call static to get revert string
            await seeker.rawFulfillRandomWords.staticCall(REQUEST_ID, randomWords, { gasLimit: 3000000 });
        } catch (staticError) {
            console.error("Static Call Revert Reason:", staticError.reason || staticError.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
