class ChiaUtils {
    static ONE_TRILLION = 1000000000000n;
    static M = 0x2bc830a3;
    static CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

    static async getCoinId(parent_coin_info, puzzle_hash, amount) {
        amount = BigInt(amount);
        if (parent_coin_info.startsWith("0x")) {
            parent_coin_info = parent_coin_info.slice(2);
        }
        if (puzzle_hash.startsWith("0x")) {
            puzzle_hash = puzzle_hash.slice(2);
        }

        const a = this.hexToBytes(parent_coin_info);
        const b = this.hexToBytes(puzzle_hash);
        const c = this.intToBytes(amount);

        const d = this.concatenateBytes([a, b, c]);
        const hash = await this.sha256(d);

        return "0x" + this.bytesToHex(hash);
    }

    static intToBytes(value) {
        const bytes = [];
        let remaining = value;

        do {
            bytes.unshift(Number(remaining & 0xffn));
            remaining >>= 8n;
        } while (remaining !== 0n);

        let start = 0;
        while (
            start < bytes.length &&
            (bytes[start] === 0 ||
                (bytes[start] === 0xff && (bytes[start + 1] & 0x80) !== 0))
        ) {
            start++;
        }

        return new Uint8Array(bytes.slice(start));
    }

    static hexToBytes(hexString) {
        const bytes = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
        }
        return bytes;
    }

    static bytesToHex(bytes) {
        return Array.from(bytes)
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
    }

    static concatenateBytes(bytesArrays) {
        const totalLength = bytesArrays.reduce(
            (sum, bytes) => sum + bytes.length,
            0
        );
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const bytes of bytesArrays) {
            result.set(bytes, offset);
            offset += bytes.length;
        }
        return result;
    }

    static async sha256(bytes) {
        const buffer = await crypto.subtle.digest("SHA-256", bytes);
        return new Uint8Array(buffer);
    }
    static convertBits(data, fromBits, toBits, pad = true) {
        let acc = 0;
        let bits = 0;
        const result = [];
        const maxv = (1 << toBits) - 1;
        const maxAcc = (1 << (fromBits + toBits - 1)) - 1;

        for (const value of data) {
            if (value < 0 || value >= 1 << fromBits) {
                throw new Error("Invalid Value");
            }

            acc = ((acc << fromBits) | value) & maxAcc;
            bits += fromBits;

            while (bits >= toBits) {
                bits -= toBits;
                result.push((acc >> bits) & maxv);
            }
        }

        if (pad) {
            if (bits > 0) {
                result.push((acc << (toBits - bits)) & maxv);
            }
        } else if (bits >= fromBits) {
            throw new Error("Invalid bits");
        } else if (acc !== 0 && ((acc << (toBits - bits)) & maxv) !== 0) {
            throw new Error("Invalid bits");
        }

        return result;
    }

    static bech32HrpExpand(hrp) {
        const result = [];
        for (const char of hrp) {
            result.push(char.charCodeAt(0) >> 5);
        }
        result.push(0);
        for (const char of hrp) {
            result.push(char.charCodeAt(0) & 31);
        }
        return result;
    }

    static bech32Polymod(values) {
        const generator = [
            0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3,
        ];
        let chk = 1;
        for (const value of values) {
            const top = chk >> 25;
            chk = ((chk & 0x1ffffff) << 5) ^ value;
            for (let i = 0; i < 5; i++) {
                chk ^= (top >> i) & 1 ? generator[i] : 0;
            }
        }
        return chk;
    }

    static bech32CreateChecksum(hrp, data) {
        const values = this.bech32HrpExpand(hrp).concat(
            data,
            [0, 0, 0, 0, 0, 0]
        );
        const polymod = this.bech32Polymod(values) ^ this.M;
        const result = [];
        for (let i = 0; i < 6; i++) {
            result.push((polymod >> (5 * (5 - i))) & 31);
        }
        return result;
    }

    static bech32Encode(hrp, data) {
        const combined = data.concat(this.bech32CreateChecksum(hrp, data));
        return hrp + "1" + combined.map((d) => this.CHARSET[d]).join("");
    }

    static encodePuzzleHash(puzzleHash, prefix) {
        const data = this.convertBits(puzzleHash, 8, 5);
        return this.bech32Encode(prefix, data);
    }
}
