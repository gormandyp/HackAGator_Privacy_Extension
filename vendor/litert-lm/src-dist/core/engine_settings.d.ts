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
import { RecursiveRequired } from './types.js';
import { type AdvancedSettings, Backend, type CpuConfig, EngineSettings as WasmEngineSettings, GpuArtisanConfig as WasmGpuArtisanConfig, type GpuConfig } from './wasm_binding_types.js';
export { AdvancedSettings, CpuConfig, GpuConfig };
/**
 * LiteRT-LM GpuArtisanConfig
 */
export interface GpuArtisanConfig extends Omit<WasmGpuArtisanConfig, 'supported_lora_ranks'> {
    supported_lora_ranks: number[];
}
/**
 * LiteRT-LM LlmExecutorSettings
 */
export interface LlmExecutorSettings {
    maxNumTokens?: number;
    backendConfig?: CpuConfig | GpuConfig | GpuArtisanConfig;
    samplerBackend?: Backend;
    advancedSettings?: Partial<AdvancedSettings>;
}
/**
 * LiteRT-LM EngineSettings
 */
export interface EngineSettings {
    model: string | Blob | ReadableStream<Uint8Array>;
    backend?: Backend;
    mainExecutorSettings?: LlmExecutorSettings;
    benchmarkEnabled?: boolean;
}
/**
 * Fills a WasmEngineSettings with the values from a EngineSettings.
 */
export declare function fillWasmEngineSettingsFromEngineSettings(wasmEngineSettings: WasmEngineSettings, engineSettings: EngineSettings, backend: Backend, wasm?: import("./wasm_binding_types.js").LiteRtLmWasm): void;
/**
 * Converts a WasmEngineSettings to a EngineSettings.
 *
 * Fields are populated with the WASM object's values, which may be default
 * values if they were not set.
 *
 * The returned value omits the `model` field since its TS representation is a
 * URL or stream, which does not match what the WASM object holds.
 */
export declare function wasmEngineSettingsToEngineSettings(wasmEngineSettings: WasmEngineSettings): RecursiveRequired<Omit<EngineSettings, 'model'>>;
//# sourceMappingURL=engine_settings.d.ts.map