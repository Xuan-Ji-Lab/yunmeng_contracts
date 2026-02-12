const hre = require("hardhat");
const fs = require("fs");

const TX_HASH = "0xf59d0278a2fbad64ec1c7cf4938cc47c49d9cc30606ff1841a751ac192b20c9d";

async function main() {
    console.log(`Checking status for TX: ${TX_HASH}`);

    const provider = hre.ethers.provider;
    const txReceipt = await provider.getTransactionReceipt(TX_HASH);

    if (!txReceipt) {
        console.log("Transaction not found or pending.");
        return;
    }

    console.log(`Status: ${txReceipt.status === 1 ? "Success" : "Reverted"}`);
    if (txReceipt.status !== 1) {
        console.log("Transaction reverted!");
        return;
    }

    // Load artifacts to parse logs
    const deployPath = "deploy/deployment-modular.json";
    if (!fs.existsSync(deployPath)) {
        throw new Error("Deployment file not found!");
    }
    const info = JSON.parse(fs.readFileSync(deployPath));
    const seekerAddress = info.contracts.DreamSeeker;
    const DreamSeeker = await hre.ethers.getContractFactory("DreamSeeker");
    const seeker = DreamSeeker.attach(seekerAddress);

    // Find SeekRequestSent event
    let requestId = null;
    for (const log of txReceipt.logs) {
        try {
            const parsed = seeker.interface.parseLog(log);
            if (parsed && parsed.name === "SeekRequestSent") {
                requestId = parsed.args.requestId;
                console.log(`Found Request ID: ${requestId.toString()}`);
                break;
            }
        } catch (e) {
            // ignore logs from other contracts
        }
    }

    if (!requestId) {
        console.log("No SeekRequestSent event found in this transaction.");
    }

    // Check current status in contract
    console.log("Checking request status in DreamSeeker...");
    // mapping(uint256 => RequestStatus) public s_requests;
    const reqStatus = await seeker.s_requests(requestId);

    // reqStatus is [fulfilled, exists, sender, wishText, isPaid, batchSize, timestamp]
    console.log(`Request Exists: ${reqStatus.exists}`);
    console.log(`Request Fulfilled: ${reqStatus.fulfilled}`);

    if (reqStatus.exists) {
        console.log("Result: PENDING (VRF callback not yet processed)");
    } else {
        console.log("Result: NOT FOUND (Likely completed and deleted, or never existed)");
    }

    // --- Check CloudDreamCore Config ---
    const coreAddress = info.contracts.CloudDreamCore;
    const CloudDreamCore = await hre.ethers.getContractFactory("CloudDreamCore");
    const core = CloudDreamCore.attach(coreAddress);

    const gasLimit = await core.vrfCallbackGasLimit();
    console.log(`Current VRF Callback Gas Limit: ${gasLimit.toString()}`);

    // --- Verify Events from VRF Coordinator ---
    const vrfCoordinatorAddress = info.config.vrfCoordinator;

    // ABI for RandomWordsRequested (manually defined for parsing)
    const vrfAbi = [
        "event RandomWordsRequested(bytes32 indexed keyHash, uint256 requestId, uint256 preSeed, uint64 indexed subId, uint16 minimumRequestConfirmations, uint32 callbackGasLimit, uint32 numWords, address indexed sender)"
    ];
    const vrfInterface = new hre.ethers.Interface(vrfAbi);

    console.log("\nChecking VRF Coordinator Logs...");
    for (const log of txReceipt.logs) {
        if (log.address.toLowerCase() === vrfCoordinatorAddress.toLowerCase()) {
            try {
                const parsed = vrfInterface.parseLog(log);
                if (parsed && parsed.name === "RandomWordsRequested") {
                    console.log(`\nVerified VRF Request Events:`);
                    console.log(`Key Hash: ${parsed.args.keyHash}`);
                    console.log(`Sub ID: ${parsed.args.subId}`);
                    console.log(`Callback Gas Limit: ${parsed.args.callbackGasLimit}`);
                    console.log(`Num Words: ${parsed.args.numWords}`);
                    console.log(`Sender: ${parsed.args.sender}`);

                    if (parsed.args.callbackGasLimit.toString() !== "2500000") {
                        console.warn("⚠️ WARNING: Gas Limit sent to VRF is NOT 2,500,000!");
                    } else {
                        console.log("✅ Gas Limit is correct (2,500,000).");
                    }

                    // Check Key Hash against known BSC Mainnet hash
                    const KNOWN_HASH_200 = "0xd4bb89654db74673a187bd804519e65e3f71a52bc55f11da7601a13dcf505314"; // Testnet
                    const KNOWN_HASH_MAIN = "0x114f3da0a805b6a67d6e9cd2ec746f7028f1b7376365af575cfea3550dd1aa04"; // Mainnet
                    const KNOWN_HASH_500 = "0xba6e730de88d94a5510ae6613898bfb0c3de5d16e609c5b75220e8dd8dd962b3"; // Old/Alternative

                    if (parsed.args.keyHash === KNOWN_HASH_200) console.log("Key Hash: Testnet (200 gwei)");
                    else if (parsed.args.keyHash === KNOWN_HASH_MAIN) console.log("Key Hash: Mainnet Standard");
                    else if (parsed.args.keyHash === KNOWN_HASH_500) console.log("Key Hash: Old/Alternative");
                    else console.warn(`⚠️ Unknown Key Hash! This might be why it's ignored.`);
                }
            } catch (e) {
                // ignore
            }
        }
    }
}

main().catch(console.error);
