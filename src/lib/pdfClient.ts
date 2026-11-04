/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export { isCorruptOrBinaryText, markdownToPurePlainText } from './cleanText';

// Backward compatibility aliases
export { isCorruptOrBinaryText as isRawPdfBinary } from './cleanText';
export { markdownToPurePlainText as cleanToPlainText } from './cleanText';
