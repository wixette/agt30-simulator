// SPDX-License-Identifier: Apache-2.0
/**
 *   Copyright 2020-2026 wixette@gmail.com
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 * @fileoverview The paper of a Teletype ASR-33.
 *
 * From the Altair 8800 Simulator (https://github.com/wixette/8800-simulator, Apache-2.0),
 * adapted for the AGT-30, whose standard console was an ASR-33 too (BRO69). The AMOS monitor
 * sends CR then LF at the end of a line ("return - L.F.", AMRMX p. 20). The ASR-33 printed
 * codes 5E and 5F (hex) as an up arrow and a left arrow, which the AMOS code has (AMRMX
 * p. 20); the paper keeps them as those arrows.
 */


/**
 * Models the paper in an ASR-33: bytes go in, printed lines come out.
 *
 * It is a printer, not a screen, and the difference shows. Carriage
 * return moves the carriage back to the left margin without advancing
 * the paper, and line feed advances the paper without moving the
 * carriage; they are two separate mechanisms and software drives them
 * separately. MITS BASIC emits CR CR LF between lines, so treating CR
 * as "new line" double spaces the whole session. Printing after a CR
 * without a LF overprints what is already there, which is how the
 * machine struck out a deleted character.
 *
 * No DOM here: this turns bytes into text, and the page displays it.
 */
export class Teletype {
    /**
     * @param {number=} columns The carriage width. An ASR-33 is 72.
     * @param {number=} maxLines How much paper to keep before the top
     *     of the roll is dropped.
     */
    constructor(columns = Teletype.COLUMNS, maxLines = Teletype.MAX_LINES) {
        this.columns = columns;
        this.maxLines = maxLines;
        this.clear();
    }

    /**
     * Tears off the paper and starts a fresh sheet.
     */
    clear() {
        /**
         * The printed lines, oldest first.
         * @type {Array<string>}
         */
        this.lines = [''];
        /**
         * Where the carriage is on the current line.
         * @type {number}
         */
        this.column = 0;
    }

    /**
     * Advances the paper by one line. The carriage does not move: on a
     * real machine line feed and carriage return are separate.
     */
    lineFeed() {
        this.lines.push('');
        if (this.lines.length > this.maxLines) {
            this.lines.shift();
        }
    }

    /**
     * Prints one byte.
     * @param {number} byte The byte the CPU sent.
     */
    write(byte) {
        // The ASR-33 is a seven bit machine.
        var c = byte & 0x7f;
        if (c == Teletype.CR) {
            this.column = 0;
            return;
        }
        if (c == Teletype.LF) {
            this.lineFeed();
            return;
        }
        if (c < 0x20 || c == 0x7f) {
            // Bell, rubout and the other controls print nothing.
            return;
        }
        var index = this.lines.length - 1;
        var line = this.lines[index];
        if (line.length < this.column) {
            line += ' '.repeat(this.column - line.length);
        }
        var glyph = c == 0x5e ? '↑' : c == 0x5f ? '←' : String.fromCharCode(c);
        this.lines[index] = line.substring(0, this.column) +
            glyph + line.substring(this.column + 1);
        this.column++;
        if (this.column >= this.columns) {
            // The carriage has run out of paper width.
            this.column = 0;
            this.lineFeed();
        }
    }

    /**
     * Prints a string, one byte at a time. The arrows are the ASR-33's 5E and 5F.
     * @param {string} text The text.
     */
    writeText(text) {
        for (const ch of text) {
            this.write(ch == '↑' ? 0x5e : ch == '←' ? 0x5f : ch.charCodeAt(0));
        }
    }

    /**
     * @return {string} Everything printed so far.
     */
    getText() {
        return this.lines.join('\n');
    }

    /**
     * Translates a key press into the byte the ASR-33 would have sent.
     *
     * The keyboard was upper case only, and AMOS is single case
     * (AMRMX p. 20). Backspace rubs out the last character and Escape
     * kills the line: our conveniences; the AMOS monitor's own were "*"
     * to restart an argument and "?" to restart a statement.
     * @param {string} key The KeyboardEvent key value.
     * @param {boolean=} ctrlKey Whether control was held.
     * @return {?number} The byte to send, or null to ignore the key.
     */
    static keyToByte(key, ctrlKey = false) {
        if (ctrlKey) {
            if (key == 'c' || key == 'C') return Teletype.BREAK;
            if (key == 'u' || key == 'U') return Teletype.KILL_LINE;
            return null;
        }
        if (key == 'Enter') return Teletype.CR;
        if (key == 'Backspace' || key == 'Delete') return Teletype.RUBOUT;
        if (key == 'Escape') return Teletype.KILL_LINE;
        if (key == 'Tab') return 0x09;
        if (key.length != 1) return null;
        var c = key.toUpperCase().charCodeAt(0);
        return c < 0x80 ? c : null;
    }
};

/** The carriage width of an ASR-33. @type {number} */
Teletype.COLUMNS = 72;

/** How many printed lines to keep. @type {number} */
Teletype.MAX_LINES = 500;

/** Carriage return. @type {number} */
Teletype.CR = 0x0d;

/** Line feed. @type {number} */
Teletype.LF = 0x0a;

/** Control-C. @type {number} */
Teletype.BREAK = 0x03;

/** Rub out the last character (Backspace). @type {number} */
Teletype.RUBOUT = 0x7f;

/** Throw away the line (Escape). @type {number} */
Teletype.KILL_LINE = 0x15;
