import itertools
from Crypto.Hash import keccak

TARGET = "ef7ec2e7"

def get_selector(sig):
    k = keccak.new(digest_bits=256)
    k.update(sig.encode('utf-8'))
    return k.hexdigest()[:8]

verbs = ["swap", "exact", "execute", "buy", "sell", "trade", "multicall", "route", "dispatch"]
nouns = ["Input", "Output", "ETH", "Tokens", "Asset", "Exact", "Single", "Multi"]
suffixes = ["", "Single", "Multi", "Params", "V2", "V3", "WithPermit", "ForTokens"]

structures = [
    # Based on TX analysis: 5 params?
    # (address token, uint amountIn, uint amountOutMin, bytes path/data, address recipient)
    "(address,uint256,uint256,bytes,address)",
    "((address,uint256,uint256,bytes,address))",
    "(tuple(address,uint256,uint256,bytes,address))",
    
    # Variations
    "(address,uint256,uint256,bytes,uint256)", # Param 5 is deadline?
    "((address,uint256,uint256,bytes,uint256))",
    
    # 4 params
    "(address,uint256,uint256,bytes)",
    "((address,uint256,uint256,bytes))",
    
    # SwapExactInput standard
    "(bytes,uint256,uint256,address,uint256)",
    "((bytes,uint256,uint256,address,uint256))",
    
    # Flap/Tax Token
    "(uint256,uint256,address[],address,uint256)",
    "(uint256,uint256,address[],address)"
]

print(f"Cracking Portal {TARGET}...")

found = False
for v in verbs:
    for n in nouns:
        for s in suffixes:
            name = f"{v}{n}{s}"
            if not name: continue
            name_camel = name[0].lower() + name[1:]
            
            for args in structures:
                # Try raw args
                sig = f"{name_camel}{args}"
                if get_selector(sig) == TARGET:
                    print(f"✅ FOUND: {sig}")
                    found = True; break
                
                # Try with struct name? No, signature uses tuple types.
            if found: break
        if found: break
    if found: break

if not found:
    print("❌ Failed to crack.")
