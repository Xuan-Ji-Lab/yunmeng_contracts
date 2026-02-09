const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🎲 Starting Hardhat Fork Probability Simulation (1000 Runs)...");

    // 0. Reset Fork to Recent Block
    const RPC_URLS = [
        "https://bsc-testnet.publicnode.com",
        "https://bsc-testnet.rpc.blxrbdn.com",
        "https://chapel.binance.com",
        "https://data-seed-prebsc-1-s1.binance.org:8545/"
    ];

    let forkBlock = 0;
    let selectedRpc = "";

    // Try to find a working RPC and block
    for (const rpc of RPC_URLS) {
        try {
            console.log(`Trying RPC: ${rpc}...`);
            // ethers v6 provider
            const provider = new ethers.JsonRpcProvider(rpc);
            const block = await provider.getBlockNumber();
            if (block > 0) {
                forkBlock = block - 15; // Safe margin
                selectedRpc = rpc;
                console.log(`✅ Found valid block: ${forkBlock} on ${rpc}`);
                break;
            }
        } catch (e) {
            console.log(`❌ RPC Failed: ${e.message}`);
        }
    }

    if (!selectedRpc) {
        console.error("❌ Could not find working RPC for forking.");
        return;
    }

    console.log(`Resetting Fork to Block ${forkBlock}...`);
    await network.provider.request({
        method: "hardhat_reset",
        params: [
            {
                forking: {
                    jsonRpcUrl: selectedRpc,
                    blockNumber: forkBlock,
                },
            },
        ],
    });
    console.log("✅ Fork Reset Complete.");

    // 1. Load Contracts
    const deploymentPath = path.join(__dirname, "../../ethereal-realm/src/deployment-modular.json");
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const contracts = deploymentInfo.contracts;

    const Seeker = await ethers.getContractAt("DreamSeeker", contracts.DreamSeeker);

    // 2. Deploy Mock VRF Coordinator
    console.log("Deploying MockVRFCoordinator...");
    const MockVRF = await ethers.getContractFactory("MockVRFCoordinator");
    const mockVrf = await MockVRF.deploy();
    await mockVrf.waitForDeployment();
    console.log(`MockVRF deployed at: ${await mockVrf.getAddress()}`);

    // 3. Impersonate Admin
    const [deployer] = await ethers.getSigners();
    const adminAddress = deployer.address;

    await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [adminAddress],
    });
    const adminSigner = await ethers.getSigner(adminAddress);

    // Fund Admin
    await network.provider.send("hardhat_setBalance", [
        adminAddress,
        "0x1000000000000000000000", // 4096 ETH
    ]);

    // 4. Update VRF Config
    console.log("Updating DreamSeeker VRF Config to Mock...");
    try {
        await Seeker.connect(adminSigner).setVRFConfig(
            await mockVrf.getAddress(),
            "0xba6e730de88d94a5510ae6613898bfb0c3de5d16e609c5b7da808747125506f7", // dummy hash
            1, // subId
            2500000, // gas limit
            3 // request confirmations
        );
        console.log("✅ VRF Config Updated.");
    } catch (e) {
        console.error("❌ Failed to update VRF Config:", e.message);
        return;
    }

    // 5. Set Cost to 0
    const originalKarmaCost = await Seeker.karmaCost();
    const originalPityBase = await Seeker.pityBase();
    const originalPityThreshold = await Seeker.pityThreshold();

    await Seeker.connect(adminSigner).setSeekConfig(
        0,
        originalKarmaCost,
        originalPityBase,
        originalPityThreshold
    );
    console.log("✅ Seek Cost set to 0.");

    // 6. Run Simulation
    const RUNS = 1000;
    console.log(`\n🚀 Starting ${RUNS} runs...`);

    const results = { tier0: 0, tier1: 0, tier2: 0, tier3: 0, tier4: 0 };

    for (let i = 0; i < RUNS; i++) {
        if (i > 0 && i % 50 === 0) process.stdout.write(`\nRun ${i}: `);

        try {
            // 1. Request
            const tx = await Seeker.connect(adminSigner).seekTruth("Simulated Wish", { value: 0 });
            const rc = await tx.wait();

            // Find Request ID
            const reqEvent = rc.logs.find(x => x.fragment && x.fragment.name === 'SeekRequestSent');
            if (!reqEvent) {
                process.stdout.write("?");
                continue;
            }
            const reqId = reqEvent.args[0];

            // 2. Fulfill
            const randomNum = ethers.toBigInt(ethers.randomBytes(32));
            const fulfillTx = await mockVrf.fulfillRandomWordsWithType(reqId, [randomNum]);
            const fulfillRc = await fulfillTx.wait();

            // 3. Catch Result
            let resultEvent;
            // Scan all logs for SeekResult
            for (const log of fulfillRc.logs) {
                if (log.address.toLowerCase() === contracts.DreamSeeker.toLowerCase()) {
                    try {
                        const parsed = Seeker.interface.parseLog(log);
                        if (parsed && parsed.name === 'SeekResult') {
                            resultEvent = parsed;
                            break;
                        }
                    } catch (e) { }
                }
            }

            if (resultEvent) {
                const tier = Number(resultEvent.args[1]);
                if (tier === 0) results.tier0++;
                else if (tier === 1) results.tier1++;
                else if (tier === 2) results.tier2++;
                else if (tier === 3) results.tier3++;
                else results.tier4++;

                process.stdout.write(".");
            } else {
                process.stdout.write("x"); // Failed to find result
            }
        } catch (error) {
            process.stdout.write("E");
            // console.error(error);
        }
    }

    // 7. Report
    console.log("\n\n--- 📊 Simulation Report (1000 Runs) ---");
    console.log(`Total Runs: ${RUNS}`);
    console.log(`Tier 0 (Guixu - 0.1%):   ${results.tier0} (${(results.tier0 / RUNS * 100).toFixed(1)}%)`);
    console.log(`Tier 1 (Divine - 1.0%):  ${results.tier1} (${(results.tier1 / RUNS * 100).toFixed(1)}%)`);
    console.log(`Tier 2 (Ether - 3.0%):   ${results.tier2} (${(results.tier2 / RUNS * 100).toFixed(1)}%)`);
    console.log(`Tier 3 (Rare - 10.0%):   ${results.tier3} (${(results.tier3 / RUNS * 100).toFixed(1)}%)`);
    console.log(`Tier 4 (Common - 85.9%): ${results.tier4} (${(results.tier4 / RUNS * 100).toFixed(1)}%)`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
