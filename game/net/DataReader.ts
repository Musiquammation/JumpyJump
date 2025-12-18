export class DataReader {
	private view: DataView;
	private offset = 0;

	constructor(buffer: ArrayBuffer) {
		this.view = new DataView(buffer);
	}

	readInt8(): number {
		const val = this.view.getInt8(this.offset);
		this.offset += 1;
		return val;
	}

	readUint8(): number {
		const val = this.view.getUint8(this.offset);
		this.offset += 1;
		return val;
	}

	readInt16(littleEndian: boolean = true): number {
		const val = this.view.getInt16(this.offset, littleEndian);
		this.offset += 2;
		return val;
	}

	readUint16(littleEndian: boolean = true): number {
		const val = this.view.getUint16(this.offset, littleEndian);
		this.offset += 2;
		return val;
	}

	readInt32(littleEndian: boolean = true): number {
		const val = this.view.getInt32(this.offset, littleEndian);
		this.offset += 4;
		return val;
	}

	readUint32(littleEndian: boolean = true): number {
		const val = this.view.getUint32(this.offset, littleEndian);
		this.offset += 4;
		return val;
	}

	readFloat32(littleEndian: boolean = true): number {
		const val = this.view.getFloat32(this.offset, littleEndian);
		this.offset += 4;
		return val;
	}

	readFloat64(littleEndian: boolean = true): number {
		const val = this.view.getFloat64(this.offset, littleEndian);
		this.offset += 8;
		return val;
	}

	read256(): string {
		const bytes = new Uint8Array(this.view.buffer, this.offset, 8);
		this.offset += 8;

		let hex = '';
		for (const b of bytes) {
			hex += ((b >> 4) & 0xF).toString(16);
			hex += (b & 0xF).toString(16);
		}
		return hex;
	}

}
