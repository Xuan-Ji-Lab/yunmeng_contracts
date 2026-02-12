const hre = require("hardhat");

async function main() {
    const txHash = "0xa17e244476dadfed16e02f8d127b74305d3ea5cbfdf95bad51ecf3f95efd0af5";
    console.log(`Analyzing transaction: ${txHash}`);

    const provider = hre.ethers.provider;
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
        console.log("❌ Transaction receipt not found.");
        return;
    }

    console.log(`Status: ${receipt.status === 1 ? "✅ Success" : "❌ Reverted"}`);
    console.log(`Block: ${receipt.blockNumber}`);

    // Parse logs
    // We need ABIs to parse logs. Let's try to identify WishRequested.
    // Event: WishRequested(uint256 requestId, address roller, uint256 amount)
    // Topic0 (keccak256): 0x... (calculated below)

    const iface = new hre.ethers.Interface([
        "event WishRequested(uint256 requestId, address roller, uint256 amount)",
        "event RandomWordsRequested(bytes32 indexed keyHash, uint256 requestId, uint256 preSeed, uint64 index, uint16 minimumRequestConfirmations, uint32 callbackGasLimit, uint32 numWords, address indexed sender)"
    ]);

    let requestId = null;

    receipt.logs.forEach((log, i) => {
        try {
            const parsed = iface.parseLog(log);
            if (parsed) {
                console.log(`\nLog #${i} [${parsed.name}]:`);
                console.log(parsed.args);
                if (parsed.name === "WishRequested") {
                    requestId = parsed.args.requestId;
                }
            }
        } catch (e) {
            // Ignore unparseable logs
        }
    });

    if (requestId) {
        console.log(`\n🆔 Request ID found: ${requestId}`);
        console.log("If no response received, check:");
        console.log("1. LINK Balance in VRF Subscription");
        console.log("2. Is Consumer Added?");
    } else {
        console.log("\n⚠️ No WishRequested event found. Did the transaction fail silently?");
    }
}

main().catch(console.error);
