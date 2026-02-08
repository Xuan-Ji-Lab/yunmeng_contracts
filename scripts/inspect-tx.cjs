const hre = require("hardhat");

async function main() {
    const txHash = "0xbc15b3436f92b50ef5c14f2cbfa452ef2ad9b10a9f5277cc304dcdb856dd3553";
    console.log("Inspecting TX:", txHash);

    const tx = await hre.ethers.provider.getTransaction(txHash);
    if (!tx) {
        console.log("Transaction not found. Check network or archive node.");
        return;
    }

    console.log("--- Transaction Details ---");
    console.log("To:", tx.to);
    console.log("Value:", hre.ethers.formatEther(tx.value), "BNB");
    console.log("Input Data:", tx.data);

    // Analyze 0xef7ec2e7
    if (tx.data.startsWith("0xef7ec2e7")) {
        console.log("\n--- Analyzing 0xef7ec2e7 ---");
        const raw = tx.data.slice(10); // remove selector

        // Split into 32-byte chunks
        const chunks = [];
        for (let i = 0; i < raw.length; i += 64) {
            chunks.push(raw.slice(i, i + 64));
        }

        console.log("Total 32-byte words:", chunks.length);
        chunks.forEach((c, i) => {
            console.log(`[${i}] ${c}`);
        });

        // Try to interpret common patterns manually
        console.log("\n--- Decoded Guess ---");
        try {
            const p0 = chunks[0] ? "0x" + chunks[0].slice(24) : "?"; // Address?
            const p1 = chunks[1] ? BigInt("0x" + chunks[1]) : "?"; // Amount?
            const p2 = chunks[2] ? BigInt("0x" + chunks[2]) : "?"; // Amount?
            // p3 usually offset to bytes
            const p4 = chunks[4] ? "0x" + chunks[4].slice(24) : "?"; // Address?

            console.log("Param 0 (Addr?):", p0);
            console.log("Param 1 (Uint?):", p1.toString());
            console.log("Param 2 (Uint?):", p2.toString());
            console.log("Param 4 (Addr?):", p4);
        } catch (e) { console.log("Decode error:", e.message); }
    }
}

main().catch(console.error);
