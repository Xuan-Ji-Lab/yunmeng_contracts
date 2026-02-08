const hre = require("hardhat");

async function main() {
    const TARGET_SEEKER = "0x2f71b237";
    const TARGET_PORTAL = "0xef7ec2e7";

    console.log(`Checking DreamSeeker (${TARGET_SEEKER}) and Portal (${TARGET_PORTAL})...`);

    // 1. DreamSeeker Functions & Getters
    const seekerFuncs = [
        "castWish(string)",
        "seekTruth(string)",
        "debugSeek()",
        "rawFulfillRandomWords(uint256,uint256[])",
        "getUnclaimedDividend(address)",
        "claimDividend()",
        "testForceAbyss(string)",
        "testForcePity(uint256)",
        "setTester(address,bool)",
        "getUserWishCount(address)",
        "getGlobalWishCount()",
        "getUserWishIdsBatch(address,uint256,uint256)",
        "getUserPityIds(address)",
        "getWishRecordsBatch(uint256[])",
        "setConfig(address,address,address)",
        "setSeekConfig(uint256,uint256,uint256,uint256)",
        "setAbyssRatios(uint256,uint256)",
        "setTierThresholds(uint16[4])",
        "initialize(address,address,address,address,address)",

        // State Getters
        "wishToken()",
        "core()",
        "treasury()",
        "drifter()",
        "vrfCoordinator()",
        "seekCost()",
        "karmaCost()",
        "pityBase()",
        "pityThreshold()",
        "abyssWinnerRatio()",
        "abyssDividendRatio()",
        "totalAbyssHolders()",
        "totalAbyssTribulations()",
        "dividendPerShareToken()",
        "totalDividendsAllocated()",
        "totalDividendsClaimed()",
        "testers(address)",
        "tribulationCounts(address)",
        "userTribulationWeight(address)",
        "isAbyssHolder(address)",
        "hasPaid(address)",
        "xDividendPerShareToken(address)",
        "s_requests(uint256)",
        "tierThresholds(uint256)",
        "userWishIds(address,uint256)",
        "userPityIds(address,uint256)",
        "allWishes(uint256)",
        "allPityRecords(uint256)",

        // Common Upgradable
        "owner()",
        "implementation()",
        "upgradeTo(address)",
        "upgradeToAndCall(address,bytes)",
        "proxiableUUID()",
        "version()"
    ];

    console.log("\n--- DreamSeeker Results ---");
    for (const f of seekerFuncs) {
        const hash = hre.ethers.id(f).slice(0, 10);
        if (hash === TARGET_SEEKER) {
            console.log(`✅ MATCH FOUND: ${f} -> ${hash}`);
        }
    }

    // 2. Portal Crack (0xef7ec2e7)
    console.log("\n--- Portal Results ---");
    const portalCandidates = [
        // Basic Swap
        "swapExactInput(address,uint256,uint256,bytes,address)",
        "swapExactInput((address,uint256,uint256,bytes,address))",
        "swapExactInput(tuple(address,uint256,uint256,bytes,address))",
        "swapExactInput(address,uint256,uint256,bytes,uint256)",
        "swapExactInput((address,uint256,uint256,bytes,uint256))",

        // Exact Input
        "exactInput(address,uint256,uint256,bytes,address)",
        "exactInput((address,uint256,uint256,bytes,address))",
        "exactInput(tuple(address,uint256,uint256,bytes,address))",

        // Tax/Flap Specific
        "buy(uint256,uint256)",
        "buy(address,uint256)",
        "buyToken(address,uint256)",
        "swapETHForExactTokens(uint256,address[],address,uint256)",
        "swapExactETHForTokens(uint256,address[],address,uint256)",
        "swapExactETHForTokensSupportingFeeOnTransferTokens(uint256,address[],address,uint256)"
    ];

    // Permutations for Portal?
    // Let's assume params are: Token, Amount, MinOut, Bytes(path?), Recipient
    // Or: ParamsStruct

    const structTypes = ["address", "uint256", "uint256", "bytes", "address"];

    // Try to hash "exactInput((...))" with diff types

    for (const f of portalCandidates) {
        const hash = hre.ethers.id(f).slice(0, 10);
        if (hash === TARGET_PORTAL) {
            console.log(`✅ MATCH FOUND: ${f}`);
        }
    }
}

main().catch(console.error);
