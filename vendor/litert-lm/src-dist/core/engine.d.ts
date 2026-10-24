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
import { Conversation } from './conversation.js';
import { ConversationConfig } from './conversation_config.js';
import { EngineSettings } from './engine_settings.js';
import { Session } from './session.js';
import { RecursiveRequired } from './types.js';
import { Deletable } from './wasm_binding_types.js';
/**
 * LiteRT-LM Engine
 */
export declare class Engine implements Deletable {
    private readonly wasm;
    private readonly engine;
    private readonly deleteCallback;
    readonly settings: RecursiveRequired<EngineSettings>;
    private mutexes;
    private constructor();
    static create(engineSettings: EngineSettings, inputPromptAsHint?: string): Promise<Engine>;
    createSession(sessionConfig?: {}): Promise<Session>;
    createConversation(config?: ConversationConfig): Promise<Conversation>;
    delete(): Promise<void>;
}
//# sourceMappingURL=engine.d.ts.map