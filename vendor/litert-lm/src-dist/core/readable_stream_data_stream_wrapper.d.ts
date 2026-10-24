/**
 * Copyright 2026 The ODML Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Result returned by ReadableStreamDataStreamWrapper methods to C++ Emval.
 */
export declare interface ReadableStreamDataStreamResult {
    error?: Error;
}
/**
 * Extern interface for ReadableStreamDataStreamWrapper methods invoked by C++.
 */
export declare interface ReadableStreamDataStreamWrapperInterface {
    readAndDiscard(destAddress: number, offset: number | bigint, count: number | bigint): Promise<ReadableStreamDataStreamResult>;
    readAndPreserve(destAddress: number, offset: number | bigint, count: number | bigint): Promise<ReadableStreamDataStreamResult>;
    discard(offset: number | bigint, count: number | bigint): ReadableStreamDataStreamResult;
}
/**
 * Wraps a ReadableStream for use in LiteRT LM C++ streamed model loading.
 */
export declare class ReadableStreamDataStreamWrapper implements ReadableStreamDataStreamWrapperInterface {
    private readonly stream;
    private readonly getWasmHeap;
    readonly bytesPerSlice: number;
    private slices;
    private streamDone;
    private globalPosition;
    private reader;
    private leftoverData?;
    private isReading;
    constructor(stream: ReadableStream<Uint8Array>, getWasmHeap: () => Uint8Array, bytesPerSlice?: number);
    private getViews;
    private readInternal;
    private fillBufferFromStream;
    private doDiscard;
    readAndDiscard(destAddress: number, offset: number | bigint, count: number | bigint): Promise<ReadableStreamDataStreamResult>;
    readAndPreserve(destAddress: number, offset: number | bigint, count: number | bigint): Promise<ReadableStreamDataStreamResult>;
    discard(offset: number | bigint, count: number | bigint): ReadableStreamDataStreamResult;
}
//# sourceMappingURL=readable_stream_data_stream_wrapper.d.ts.map