export class DataWriter {
	private buffer: ArrayBuffer;
	private view: DataView;
	private offset = 0;

	constructor(size: number = 64) {
		this.buffer = new ArrayBuffer(size);
		this.view = new DataView(this.buffer);
	}

	private checkSize(required: number) {
		const needed = this.offset + required;

		if (needed <= this.buffer.byteLength) return;

		let newSize = this.buffer.byteLength;
		while (newSize < needed) {
			newSize *= 2;
		}

		const newBuffer = new ArrayBuffer(newSize);
		new Uint8Array(newBuffer).set(new Uint8Array(this.buffer));

		this.buffer = newBuffer;
		this.view = new DataView(this.buffer);
	}

	writeInt8(value: number) {
		this.checkSize(1);
		this.view.setInt8(this.offset, value);
		this.offset += 1;
		return this;
	}

	writeUint8(value: number) {
		this.checkSize(1);
		this.view.setUint8(this.offset, value);
		this.offset += 1;
		return this;
	}

	writeInt16(value: number, littleEndian: boolean = true) {
		this.checkSize(2);
		this.view.setInt16(this.offset, value, littleEndian);
		this.offset += 2;
		return this;
	}

	writeUint16(value: number, littleEndian: boolean = true) {
		this.checkSize(2);
		this.view.setUint16(this.offset, value, littleEndian);
		this.offset += 2;
		return this;
	}

	writeInt32(value: number, littleEndian: boolean = true) {
		this.checkSize(4);
		this.view.setInt32(this.offset, value, littleEndian);
		this.offset += 4;
		return this;
	}

	writeUint32(value: number, littleEndian: boolean = true) {
		this.checkSize(4);
		this.view.setUint32(this.offset, value, littleEndian);
		this.offset += 4;
		return this;
	}

	writeFloat32(value: number, littleEndian: boolean = true) {
		this.checkSize(4);
		this.view.setFloat32(this.offset, value, littleEndian);
		this.offset += 4;
		return this;
	}

	writeFloat64(value: number, littleEndian: boolean = true) {
		this.checkSize(8);
		this.view.setFloat64(this.offset, value, littleEndian);
		this.offset += 8;
		return this;
	}

	static getHex(caracter: string) {
		switch (caracter) {
			case '0': return  0;
			case '1': return  1;
			case '2': return  2;
			case '3': return  3;
			case '4': return  4;
			case '5': return  5;
			case '6': return  6;
			case '7': return  7;
			case '8': return  8;
			case '9': return  9;
			case 'a': return 10;
			case 'b': return 11;
			case 'c': return 12;
			case 'd': return 13;
			case 'e': return 14;
			case 'f': return 15;
			default:  return 0;
		}
	}


	write256(hex: string | null) {
		if (hex === null) {
			this.checkSize(8);					
			for (let i = 0; i < 8; i++) {
				this.view.setUint8(this.offset++, 0);
			}
			
			return;
		}

		if (hex.length !== 16) throw new Error('Hex string must be 16 characters (8 bytes)');

		this.checkSize(8);

		for (let i = 0; i < 16; i += 2) {
			const byte = (DataWriter.getHex(hex[i]) << 4) | DataWriter.getHex(hex[i+1]);
			this.view.setUint8(this.offset++, byte);
		}
	}

	toArrayBuffer(): ArrayBuffer {
		return this.buffer.slice(0, this.offset);
	}


	addWriter(writer: DataWriter) {
		const length = writer.getOffset();
		if (length === 0) return;

		this.checkSize(length);
		new Uint8Array(this.buffer, this.offset, length)
			.set(new Uint8Array(writer.toArrayBuffer()));

		this.offset += length;
	}


	getOffset() : number {
		return this.offset;
	}
	
}
