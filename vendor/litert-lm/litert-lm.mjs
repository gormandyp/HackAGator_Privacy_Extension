var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/@litert-lm/core/dist/global_litertlm.js
var LiteRtLmNotLoadedError = class extends Error {
  constructor() {
    super("LiteRT-LM is not initialized yet. Please call loadLiteRtLm() and wait for its promise to resolve to load the LiteRT-LM WASM module.");
  }
};
var globalLiteRtLm = void 0;
var globalLiteRtLmPromise = void 0;
function getGlobalLiteRtLm() {
  if (!globalLiteRtLm) {
    throw new LiteRtLmNotLoadedError();
  }
  return globalLiteRtLm;
}
function hasGlobalLiteRtLm() {
  return Boolean(globalLiteRtLm);
}
function setGlobalLiteRtLm(LiteRtLm2) {
  globalLiteRtLm = LiteRtLm2;
}
function getGlobalLiteRtLmPromise() {
  return globalLiteRtLmPromise;
}
function hasGlobalLiteRtLmPromise() {
  return Boolean(globalLiteRtLmPromise);
}
function setGlobalLiteRtLmPromise(promise) {
  globalLiteRtLmPromise = promise;
}

// node_modules/@litert-lm/core/dist/litertlm_web.js
async function setupDefaultWebGpuDevice() {
  await getGlobalLiteRtLm().setupDefaultWebGpuDevice();
}
var LiteRtLm = class {
  liteRtLmWasm;
  static DEFAULT_WASM_PATH = "https://cdn.jsdelivr.net/npm/@litert-lm/core@0.18.0/wasm";
  constructor(wasmModule) {
    this.liteRtLmWasm = wasmModule;
    this.liteRtLmWasm.setupLogging();
  }
  async setupDefaultWebGpuDevice() {
    if (this.liteRtLmWasm.preinitializedWebGPUDevice) {
      return;
    }
    this.liteRtLmWasm.preinitializedWebGPUDevice = await createDefaultWebGpuDevice();
  }
  delete() {
  }
};
var DESIRED_WEBGPU_FEATURES = [
  "shader-f16",
  "subgroups"
];
async function createDefaultWebGpuDevice() {
  const adapterDescriptor = {
    powerPreference: "high-performance"
  };
  const adapter = await navigator.gpu.requestAdapter(adapterDescriptor);
  if (!adapter) {
    throw new Error("No GPU adapter found.");
  }
  const requiredLimits = {
    maxBufferSize: adapter.limits.maxBufferSize,
    maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
    maxStorageBuffersPerShaderStage: adapter.limits.maxStorageBuffersPerShaderStage,
    maxTextureDimension2D: adapter.limits.maxTextureDimension2D
  };
  const requiredFeatures = [];
  for (const feature of DESIRED_WEBGPU_FEATURES) {
    if (adapter.features.has(feature)) {
      requiredFeatures.push(feature);
    }
  }
  return await adapter.requestDevice({
    requiredFeatures,
    requiredLimits
  });
}

// node_modules/@litertjs/wasm-utils/dist/index.js
async function runScript(scriptUrl) {
  if (typeof importScripts === "function") {
    importScripts(scriptUrl.toString());
  } else {
    const script = document.createElement("script");
    script.src = scriptUrl.toString();
    script.crossOrigin = "anonymous";
    return new Promise((resolve, revoke) => {
      script.addEventListener("load", () => {
        resolve();
      }, false);
      script.addEventListener("error", (e) => {
        revoke(e);
      }, false);
      document.body.appendChild(script);
    });
  }
}
var createWasmLib = async (constructorFcn, wasmLoaderScript, assetLoaderScript, glCanvas, fileLocator) => {
  if (wasmLoaderScript) {
    await runScript(wasmLoaderScript);
  }
  if (!self.ModuleFactory) {
    throw new Error("ModuleFactory not set.");
  }
  if (assetLoaderScript) {
    await runScript(assetLoaderScript);
    if (!self.ModuleFactory) {
      throw new Error("ModuleFactory not set.");
    }
  }
  if (self.Module && fileLocator) {
    const moduleFileLocator = self.Module;
    moduleFileLocator.locateFile = fileLocator.locateFile;
    if (fileLocator.mainScriptUrlOrBlob) {
      moduleFileLocator.mainScriptUrlOrBlob = fileLocator.mainScriptUrlOrBlob;
    }
  }
  const module = await self.ModuleFactory(self.Module || fileLocator);
  self.ModuleFactory = self.Module = void 0;
  return new constructorFcn(module, glCanvas);
};

// node_modules/@litert-lm/core/dist/url_path_utils.js
function pathToString(path) {
  return path;
}
function appendPathSegment(path, segment) {
  if (!path)
    return segment;
  if (!segment)
    return path;
  const pathWithSlash = path.endsWith("/") ? path : path + "/";
  const segmentWithoutSlash = segment.startsWith("/") ? segment.substring(1) : segment;
  return pathWithSlash + segmentWithoutSlash;
}

// node_modules/@litert-lm/core/dist/wasm_feature_detect.js
var WASM_RELAXED_SIMD_CHECK = new Uint8Array([
  0,
  97,
  115,
  109,
  1,
  0,
  0,
  0,
  1,
  5,
  1,
  96,
  0,
  1,
  123,
  3,
  2,
  1,
  0,
  10,
  15,
  1,
  13,
  0,
  65,
  1,
  253,
  15,
  65,
  2,
  253,
  15,
  253,
  128,
  2,
  11
]);
var WASM_THREADS_CHECK = new Uint8Array([
  0,
  97,
  115,
  109,
  1,
  0,
  0,
  0,
  1,
  4,
  1,
  96,
  0,
  0,
  3,
  2,
  1,
  0,
  5,
  4,
  1,
  3,
  1,
  1,
  10,
  11,
  1,
  9,
  0,
  65,
  0,
  254,
  16,
  2,
  0,
  26,
  11
]);
var WASM_FEATURE_VALUES = {
  "relaxedSimd": void 0,
  "threads": void 0,
  "jspi": void 0
};
function isJspiSupported() {
  return "Suspending" in WebAssembly;
}
async function tryWasm(wasm) {
  try {
    await WebAssembly.instantiate(wasm);
    return { supported: true };
  } catch (e) {
    return { supported: false, error: e };
  }
}
var WASM_FEATURE_CHECKS = {
  "relaxedSimd": () => {
    if (WASM_FEATURE_VALUES.relaxedSimd === void 0) {
      WASM_FEATURE_VALUES.relaxedSimd = tryWasm(WASM_RELAXED_SIMD_CHECK);
    }
    return WASM_FEATURE_VALUES.relaxedSimd;
  },
  "threads": () => {
    if (WASM_FEATURE_VALUES.threads === void 0) {
      try {
        if (typeof MessageChannel !== "undefined") {
          new MessageChannel().port1.postMessage(new SharedArrayBuffer(1));
        }
        WASM_FEATURE_VALUES.threads = tryWasm(WASM_THREADS_CHECK);
      } catch (e) {
        WASM_FEATURE_VALUES.threads = Promise.resolve({ supported: false, error: e });
      }
    }
    return WASM_FEATURE_VALUES.threads;
  },
  "jspi": () => {
    if (WASM_FEATURE_VALUES.jspi === void 0) {
      try {
        const supported = isJspiSupported();
        WASM_FEATURE_VALUES.jspi = Promise.resolve({
          supported,
          error: supported ? void 0 : new Error("JSPI is not supported")
        });
      } catch (e) {
        WASM_FEATURE_VALUES.jspi = Promise.resolve({ supported: false, error: e });
      }
    }
    return WASM_FEATURE_VALUES.jspi;
  }
};
async function supportsFeature(feature) {
  const check = WASM_FEATURE_CHECKS[feature]?.();
  if (!check) {
    throw new Error(`Unknown feature: ${feature}`);
  }
  return (await check).supported;
}

// node_modules/@litert-lm/core/dist/load.js
var WASM_JS_FILE_NAME = "litertlm_wasm_internal.js";
var WASM_JS_COMPAT_FILE_NAME = "litertlm_wasm_compat_internal.js";
var WASM_JS_ASYNCIFY_FILE_NAME = "litertlm_wasm_asyncify_internal.js";
var WASM_JS_COMPAT_ASYNCIFY_FILE_NAME = "litertlm_wasm_compat_asyncify_internal.js";
async function load(path, options) {
  const pathString = pathToString(path);
  const relaxedSimd = await supportsFeature("relaxedSimd");
  const jspi = await supportsFeature("jspi");
  let fileName = "";
  if (relaxedSimd) {
    fileName = jspi ? WASM_JS_FILE_NAME : WASM_JS_ASYNCIFY_FILE_NAME;
  } else {
    fileName = jspi ? WASM_JS_COMPAT_FILE_NAME : WASM_JS_COMPAT_ASYNCIFY_FILE_NAME;
  }
  let jsFilePath = path;
  if (pathString.endsWith(".wasm")) {
    throw new Error("Please load the `.js` file corresponding to the `.wasm` file, or load the directory containing it.");
  } else if (!pathString.endsWith(".js")) {
    jsFilePath = appendPathSegment(path, fileName);
  }
  return createWasmLib(LiteRtLm, jsFilePath);
}

// node_modules/@litert-lm/core/dist/load_litertlm.js
var globalLiteRtLmPath = void 0;
function loadLiteRtLm(path, options) {
  if (hasGlobalLiteRtLmPromise()) {
    throw new Error("LiteRT-LM is already loading / loaded.");
  }
  setGlobalLiteRtLmPromise(load(path, options).then(async (liteRtLm) => {
    setGlobalLiteRtLm(liteRtLm);
    return liteRtLm;
  }).catch((error) => {
    setGlobalLiteRtLmPromise(void 0);
    throw error;
  }));
  return getGlobalLiteRtLmPromise();
}
function unloadLiteRtLm() {
  if (hasGlobalLiteRtLmPromise() && !hasGlobalLiteRtLm()) {
    throw new Error("LiteRT-LM is loading and can not be unloaded or canceled until it is finished loading.");
  }
  if (hasGlobalLiteRtLm()) {
    getGlobalLiteRtLm().delete();
    setGlobalLiteRtLm(void 0);
    globalLiteRtLmPath = void 0;
  }
  setGlobalLiteRtLmPromise(void 0);
}
function getOrLoadGlobalLiteRtLm(path) {
  const liteRtLmPromise = getGlobalLiteRtLmPromise();
  if (liteRtLmPromise) {
    if (path && globalLiteRtLmPath !== path) {
      throw new Error(`LiteRT-LM is already loading / loaded with a different path ${globalLiteRtLmPath} but was requested to load ${path}. To reload with a different path, call unloadLiteRtLm() first.`);
    }
    return liteRtLmPromise;
  }
  globalLiteRtLmPath = path ?? LiteRtLm.DEFAULT_WASM_PATH;
  return liteRtLmPromise ?? loadLiteRtLm(globalLiteRtLmPath);
}

// node_modules/@litert-lm/core/dist/orchestration/webmcp_tool.js
function isWebMcpTool(tool) {
  return "inputSchema" in tool;
}
function toTool(tool) {
  const { inputSchema, execute, ...rest } = tool;
  return {
    type: "function",
    function: { ...rest, parameters: inputSchema }
  };
}

// node_modules/@litert-lm/core/dist/orchestration/auto_tool_chat.js
var BUSY_MESSAGE = "Conversation is busy. A generation is already in progress.";
var AutoToolChat = class {
  options;
  baseConversation = null;
  isBusy = false;
  isCancelled = false;
  tools = /* @__PURE__ */ new Map();
  nextToolCallId = 1;
  currentBatch = null;
  constructor(options) {
    this.options = options;
    if (options.config?.preface?.tools && options.config.preface.tools.length > 0) {
      throw new Error("AutoToolChat handles tools itself. Do not provide tools via ConversationConfig.preface.tools.");
    }
    const activeTools = options.tools || [];
    for (let t of activeTools) {
      let tool;
      if (isWebMcpTool(t)) {
        tool = { ...toTool(t), execute: t.execute };
      } else if (!("function" in t)) {
        const { execute, ...declaration } = t;
        tool = { type: "function", function: declaration, execute };
      } else {
        tool = t;
      }
      const name = tool.function.name;
      if (!name)
        throw new Error("Tool must have a name.");
      if (!tool.execute) {
        throw new Error(`Tool ${name} must have an execute function.`);
      }
      if (this.tools.has(name)) {
        throw new Error(`Duplicate tool name ${name} provided.`);
      }
      this.tools.set(name, tool);
    }
  }
  async getConversation() {
    if (!this.baseConversation) {
      const config = this.options.config ? { ...this.options.config } : {};
      if (this.tools.size > 0) {
        if (!config.preface) {
          config.preface = {};
        }
        config.preface.tools = Array.from(this.tools.values()).map((t) => {
          const { execute, ...rest } = t;
          return rest;
        });
      }
      this.baseConversation = await this.options.engine.createConversation(config);
    }
    return this.baseConversation;
  }
  async sendMessage(message) {
    if (this.isBusy) {
      throw new Error(BUSY_MESSAGE);
    }
    this.isBusy = true;
    this.isCancelled = false;
    try {
      const conversation = await this.getConversation();
      let currentMessage = message;
      const recurringToolCallLimit = this.options.recurringToolCallLimit ?? 25;
      let iteration = 0;
      while (iteration < recurringToolCallLimit) {
        iteration++;
        const responseMsg = await conversation.sendMessage(currentMessage);
        if (responseMsg.tool_calls && responseMsg.tool_calls.length > 0) {
          const toolResponses = await this.executeToolCalls(responseMsg.tool_calls);
          if (this.isCancelled) {
            throw new Error("Conversation cancelled");
          }
          currentMessage = { role: "tool", content: toolResponses };
          continue;
        }
        return responseMsg;
      }
      throw new Error("Tool calling exceeded the recurring limit");
    } finally {
      this.isBusy = false;
    }
  }
  sendMessageStreaming(message) {
    if (this.isBusy) {
      throw new Error(BUSY_MESSAGE);
    }
    this.isBusy = true;
    this.isCancelled = false;
    let isStreamCancelled = false;
    return new ReadableStream({
      start: (controller) => {
        let currentMessage = message;
        let iteration = 0;
        const recurringToolCallLimit = this.options.recurringToolCallLimit ?? 25;
        const executeIteration = async () => {
          if (iteration >= recurringToolCallLimit) {
            this.isBusy = false;
            controller.error(new Error("Tool calling exceeded the recurring limit"));
            return;
          }
          iteration++;
          let toolCalls = [];
          try {
            const conversation = await this.getConversation();
            const stream = conversation.sendMessageStreaming(currentMessage);
            for await (const chunk of stream) {
              if (isStreamCancelled || this.isCancelled) {
                break;
              }
              if (chunk.tool_calls && chunk.tool_calls.length > 0) {
                toolCalls = toolCalls.concat(chunk.tool_calls);
                const cleanValue = { ...chunk };
                delete cleanValue.tool_calls;
                if (cleanValue.content) {
                  controller.enqueue(cleanValue);
                }
              } else {
                controller.enqueue(chunk);
              }
            }
          } catch (e) {
            this.isBusy = false;
            controller.error(e);
            return;
          }
          if (isStreamCancelled || this.isCancelled)
            return;
          if (toolCalls.length > 0) {
            const toolResponses = await this.executeToolCalls(toolCalls);
            if (isStreamCancelled || this.isCancelled)
              return;
            currentMessage = { role: "tool", content: toolResponses };
            await executeIteration();
            return;
          }
          this.isBusy = false;
          controller.close();
        };
        executeIteration().catch((e) => {
          if (isStreamCancelled || this.isCancelled)
            return;
          this.isBusy = false;
          controller.error(e);
        });
      },
      cancel: () => {
        isStreamCancelled = true;
        this.cancel();
      }
    });
  }
  /**
   * Cancels the current generation.
   * Note: This does not abort any in-progress tool calls natively. Tools that
   * affect state may still complete in the background eventually, but their
   * results will be discarded and not reported back to the model or the user.
   */
  cancel() {
    this.isCancelled = true;
    if (this.currentBatch) {
      this.currentBatch.cancel();
    }
    if (this.baseConversation) {
      this.baseConversation.cancel();
    }
  }
  async getHistory() {
    const conversation = await this.getConversation();
    return conversation.getHistory();
  }
  async getTokenCount() {
    const conversation = await this.getConversation();
    return conversation.getTokenCount();
  }
  async getBenchmarkInfo() {
    const conversation = await this.getConversation();
    return conversation.getBenchmarkInfo();
  }
  async delete() {
    if (this.baseConversation) {
      await this.baseConversation.delete();
      this.baseConversation = null;
    }
  }
  async executeToolCalls(toolCalls) {
    this.currentBatch = new ToolCallBatch(this.tools, this.options.onToolProgress, () => this.nextToolCallId++);
    try {
      return await this.currentBatch.executeAll(toolCalls);
    } finally {
      this.currentBatch = null;
    }
  }
};
var ToolCallBatch = class {
  tools;
  onToolProgress;
  getNextId;
  isCancelled = false;
  constructor(tools, onToolProgress, getNextId) {
    this.tools = tools;
    this.onToolProgress = onToolProgress;
    this.getNextId = getNextId;
  }
  cancel() {
    this.isCancelled = true;
  }
  async executeAll(toolCalls) {
    return Promise.all(toolCalls.map(async (tc) => {
      const tool = this.tools.get(tc.function.name);
      const callId = this.getNextId();
      let result;
      if (this.onToolProgress) {
        this.onToolProgress({
          id: callId,
          name: tc.function.name,
          arguments: tc.function.arguments,
          status: "started"
        });
      }
      if (!tool) {
        const errorMsg = `Tool ${tc.function.name} not found.`;
        result = { error: errorMsg };
        if (!this.isCancelled && this.onToolProgress) {
          this.onToolProgress({
            id: callId,
            name: tc.function.name,
            arguments: tc.function.arguments,
            status: "error",
            error: errorMsg
          });
        }
      } else {
        try {
          result = await tool.execute(tc.function.arguments);
          if (!this.isCancelled && this.onToolProgress) {
            this.onToolProgress({
              id: callId,
              name: tc.function.name,
              arguments: tc.function.arguments,
              status: "completed",
              result
            });
          }
        } catch (e) {
          const errorMsg = String(e);
          result = {
            error: `Error executing tool ${tc.function.name}: ${errorMsg}`
          };
          if (!this.isCancelled && this.onToolProgress) {
            this.onToolProgress({
              id: callId,
              name: tc.function.name,
              arguments: tc.function.arguments,
              status: "error",
              error: errorMsg
            });
          }
        }
      }
      return { type: "tool_response", name: tc.function.name, response: result };
    }));
  }
};

// node_modules/@litert-lm/core/dist/wasm_binding_types.js
var wasm_binding_types_exports = {};
__export(wasm_binding_types_exports, {
  Backend: () => Backend,
  InputOverflowStrategy: () => InputOverflowStrategy,
  SamplerType: () => SamplerType
});
var Backend = {
  // Ideally, we'd pull these from the Wasm module, but we want them to be
  // available in JS before the Wasm module is loaded.
  UNSPECIFIED: 0,
  CPU_ARTISAN: 1,
  GPU_ARTISAN: 2,
  CPU: 3,
  GPU: 4,
  GOOGLE_TENSOR_ARTISAN: 5,
  NPU: 6
};
var SamplerType = {
  TYPE_UNSPECIFIED: 0,
  TOP_K: 1,
  TOP_P: 2,
  GREEDY: 3
};
var InputOverflowStrategy = {
  CHUNK_AND_AVERAGE: 0,
  TRUNCATE: 1,
  ERROR: 2
};

// node_modules/@litert-lm/core/dist/wasm_utils.js
function consumeEmscriptenVectorToArray(vector) {
  const array = new Array(vector.size());
  for (let i = 0; i < vector.size(); ++i) {
    array[i] = vector.get(i);
  }
  vector.delete();
  return array;
}
function fillEmscriptenVector(data, vector) {
  for (const item of data) {
    vector.push_back(item);
  }
}

// node_modules/@litert-lm/core/dist/engine_settings.js
function fillWasmEngineSettingsFromEngineSettings(wasmEngineSettings, engineSettings, backend, wasm = getGlobalLiteRtLm().liteRtLmWasm) {
  const wasmExecutorSettings = wasmEngineSettings.getMutableMainExecutorSettings();
  wasmExecutorSettings.setCacheDir(":nocache");
  if (engineSettings.benchmarkEnabled) {
    wasmEngineSettings.enableBenchmark();
  }
  if (engineSettings.mainExecutorSettings) {
    const mainExecutorSettings = engineSettings.mainExecutorSettings;
    if (mainExecutorSettings.maxNumTokens !== void 0) {
      wasmExecutorSettings.setMaxNumTokens(mainExecutorSettings.maxNumTokens);
    }
    if (mainExecutorSettings.samplerBackend !== void 0) {
      wasmExecutorSettings.setSamplerBackend({ value: mainExecutorSettings.samplerBackend });
    }
    if (mainExecutorSettings.backendConfig !== void 0) {
      const backendConfig = mainExecutorSettings.backendConfig;
      if (backend === Backend.CPU) {
        wasmExecutorSettings.setBackendConfigCpu(backendConfig);
      } else if (backend === Backend.GPU) {
        wasmExecutorSettings.setBackendConfigGpu(backendConfig);
      } else if (backend === Backend.GPU_ARTISAN) {
        const gpuArtisanConfig = backendConfig;
        const loraRanksVec = new wasm.VectorUint32();
        fillEmscriptenVector(gpuArtisanConfig.supported_lora_ranks, loraRanksVec);
        const wasmGpuArtisanConfig = {
          ...gpuArtisanConfig,
          supported_lora_ranks: loraRanksVec
        };
        wasmExecutorSettings.setBackendConfigGpuArtisan(wasmGpuArtisanConfig);
        loraRanksVec.delete();
      }
    }
    if (mainExecutorSettings.advancedSettings !== void 0) {
      const defaultAdv = wasmExecutorSettings.getAdvancedSettings();
      const newAdv = { ...defaultAdv, ...mainExecutorSettings.advancedSettings };
      wasmExecutorSettings.setAdvancedSettings(newAdv);
    }
  }
}
function wasmEngineSettingsToEngineSettings(wasmEngineSettings) {
  const wasmExecutorSettings = wasmEngineSettings.getMutableMainExecutorSettings();
  let backendConfig;
  let backend;
  try {
    backendConfig = wasmExecutorSettings.getBackendConfigCpu();
    backend = Backend.CPU;
  } catch (e) {
    try {
      backendConfig = wasmExecutorSettings.getBackendConfigGpu();
      backend = Backend.GPU;
    } catch (e2) {
      try {
        const wasmGpuArtisanConfig = wasmExecutorSettings.getBackendConfigGpuArtisan();
        backendConfig = {
          ...wasmGpuArtisanConfig,
          supported_lora_ranks: consumeEmscriptenVectorToArray(wasmGpuArtisanConfig.supported_lora_ranks)
        };
        backend = Backend.GPU_ARTISAN;
      } catch (e3) {
        throw new Error("Unsupported backend config");
      }
    }
  }
  return {
    backend,
    mainExecutorSettings: {
      maxNumTokens: wasmExecutorSettings.getMaxNumTokens(),
      samplerBackend: wasmExecutorSettings.getSamplerBackend().value,
      backendConfig,
      advancedSettings: wasmExecutorSettings.getAdvancedSettings()
    },
    benchmarkEnabled: false
  };
}

// node_modules/@litert-lm/core/dist/cleanup.js
var Cleanup = class {
  callbacks = /* @__PURE__ */ new Set();
  add(callback) {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
      callback();
    };
  }
  run() {
    for (const callback of this.callbacks) {
      callback();
    }
    this.callbacks.clear();
  }
};

// node_modules/@litert-lm/core/dist/conversation.js
var BUSY_MESSAGE2 = "Conversation is busy. A generation is already in progress.";
var Conversation = class _Conversation {
  conversation;
  engine;
  mutexes;
  isBusy = false;
  constructor(conversation, engine, mutexes) {
    this.conversation = conversation;
    this.engine = engine;
    this.mutexes = mutexes;
  }
  async sendMessage(message) {
    if (this.isBusy) {
      throw new Error(BUSY_MESSAGE2);
    }
    this.isBusy = true;
    try {
      return await this.mutexes.executor.acquireAndRun(async () => {
        const currentMessageJson = messageToJsonString(message);
        const resultStr = await this.conversation.sendMessage(currentMessageJson);
        return JSON.parse(resultStr);
      });
    } finally {
      this.isBusy = false;
    }
  }
  /**
   * Sends a message to the LLM and returns a ReadableStream that yields
   * message chunks as they are generated.
   */
  sendMessageStreaming(message) {
    if (this.isBusy) {
      throw new Error(BUSY_MESSAGE2);
    }
    this.isBusy = true;
    let isCancelled = false;
    let hasErrored = false;
    return new ReadableStream({
      start: (controller) => {
        const currentMessageJson = messageToJsonString(message);
        const executeGeneration = async () => {
          await this.mutexes.executor.acquireAndRun(async () => {
            await this.conversation.sendMessageAsync(currentMessageJson, (chunk, isDone, error) => {
              if (isCancelled || hasErrored)
                return;
              if (error) {
                hasErrored = true;
                this.isBusy = false;
                controller.error(new Error(error));
                return;
              }
              if (chunk) {
                try {
                  const msg = JSON.parse(chunk);
                  controller.enqueue(msg);
                } catch (e) {
                  hasErrored = true;
                  this.isBusy = false;
                  controller.error(e);
                }
              }
            });
            await this.engine.waitUntilDone();
          });
          if (isCancelled || hasErrored)
            return;
          this.isBusy = false;
          controller.close();
        };
        executeGeneration().catch((e) => {
          if (isCancelled || hasErrored)
            return;
          this.isBusy = false;
          controller.error(e);
        });
      },
      cancel: () => {
        isCancelled = true;
        this.isBusy = false;
        this.cancel();
      }
    });
  }
  /**
   * Sends a signal to cancel any current generation.
   */
  cancel() {
    this.conversation.cancelProcess();
  }
  async getHistory() {
    return this.mutexes.executor.acquireAndRun(() => {
      const historyStr = this.conversation.getHistory();
      return JSON.parse(historyStr);
    });
  }
  async getTokenCount() {
    return this.mutexes.executor.acquireAndRun(() => {
      return this.conversation.getTokenCount();
    });
  }
  async getBenchmarkInfo() {
    return this.mutexes.executor.acquireAndRun(() => {
      return this.conversation.getBenchmarkInfo();
    });
  }
  /**
   * Clones the conversation. The cloned conversation will be independent of the
   * original conversation, including the history, state, etc.
   */
  async clone() {
    if (this.isBusy) {
      throw new Error(BUSY_MESSAGE2);
    }
    this.isBusy = true;
    try {
      return await this.mutexes.executor.acquireAndRun(() => {
        const wasmClonedConversation = this.conversation.clone();
        return new _Conversation(wasmClonedConversation, this.engine, this.mutexes);
      });
    } finally {
      this.isBusy = false;
    }
  }
  async delete() {
    await this.mutexes.executor.acquireAndRun(() => {
      this.conversation.delete();
    });
  }
};
function messageToJsonString(messageLike) {
  let message;
  if (Array.isArray(messageLike)) {
    message = messageLike.map(toMessage);
  } else {
    message = toMessage(messageLike);
  }
  return JSON.stringify(message);
}
function toMessage(messageLike) {
  if (typeof messageLike === "string") {
    return { role: "user", content: messageLike };
  }
  return messageLike;
}

// node_modules/@litert-lm/core/dist/mutex.js
var Mutex = class {
  mutexPromise = Promise.resolve();
  queueCount = 0;
  /**
   * Whether the mutex is currently locked.
   */
  get isLocked() {
    return this.queueCount > 0;
  }
  /**
   * Executes the provided function once the mutex is acquired, and releases
   * the mutex when the function completes.
   */
  async acquireAndRun(fn) {
    this.queueCount++;
    const previousPromise = this.mutexPromise;
    let resolveMutex;
    this.mutexPromise = new Promise((resolve) => {
      resolveMutex = resolve;
    });
    try {
      await previousPromise;
      return await fn();
    } finally {
      this.queueCount--;
      resolveMutex();
    }
  }
};

// node_modules/@litert-lm/core/dist/readable_stream_data_stream_wrapper.js
var Slice = class {
  size;
  data;
  fullyDiscarded = false;
  discardedRegions = [];
  constructor(size) {
    this.size = size;
  }
  discard(start, end) {
    if (this.fullyDiscarded)
      return;
    if (this.discardedRegions.length === 0) {
      this.discardedRegions.push([start, end]);
      this.checkFullyDiscarded();
      return;
    }
    this.discardedRegions.push([start, end]);
    this.discardedRegions.sort((a, b) => a[0] - b[0]);
    const mergedRegions = [];
    for (const region of this.discardedRegions) {
      const lastRegion = mergedRegions[mergedRegions.length - 1];
      if (!lastRegion || lastRegion[1] < region[0]) {
        mergedRegions.push(region);
      } else {
        lastRegion[1] = Math.max(lastRegion[1], region[1]);
      }
    }
    this.discardedRegions = mergedRegions;
    this.checkFullyDiscarded();
  }
  getDiscardedRegions(start = 0, end = this.size) {
    const result = [];
    for (const [rStart, rEnd] of this.discardedRegions) {
      if (rStart >= end) {
        break;
      }
      if (rEnd <= start) {
        continue;
      }
      result.push([rStart, rEnd]);
    }
    return result;
  }
  checkFullyDiscarded() {
    if (this.discardedRegions.length === 1 && this.discardedRegions[0][0] === 0 && this.discardedRegions[0][1] === this.size) {
      this.fullyDiscarded = true;
      this.data = void 0;
    }
  }
};
var ReadableStreamDataStreamWrapper = class {
  stream;
  getWasmHeap;
  bytesPerSlice;
  slices = [];
  streamDone = false;
  globalPosition = 0;
  reader;
  leftoverData;
  isReading = false;
  constructor(stream, getWasmHeap, bytesPerSlice = 1e7) {
    this.stream = stream;
    this.getWasmHeap = getWasmHeap;
    this.bytesPerSlice = bytesPerSlice;
    try {
      this.reader = { byobReader: this.stream.getReader({ mode: "byob" }) };
    } catch (e) {
      this.reader = { defaultReader: this.stream.getReader() };
    }
  }
  *getViews(start, end) {
    if (start >= end) {
      return;
    }
    let scratchBuffer;
    let previousSlice;
    let position = start;
    while (position < end) {
      const sliceIndex = Math.floor(position / this.bytesPerSlice);
      const slicePosition = position % this.bytesPerSlice;
      const sliceStartGlobalPosition = sliceIndex * this.bytesPerSlice;
      let slice = this.slices[sliceIndex];
      if (!slice) {
        if (!previousSlice || !previousSlice.fullyDiscarded) {
          scratchBuffer = new Uint8Array(this.bytesPerSlice);
        }
        slice = new Slice(this.bytesPerSlice);
        slice.data = scratchBuffer;
        this.slices[sliceIndex] = slice;
      }
      const viewEnd = Math.min(this.bytesPerSlice, end - sliceStartGlobalPosition);
      const discardView = () => {
        slice.discard(slicePosition, viewEnd);
      };
      const viewLength = viewEnd - slicePosition;
      const setView = (view) => {
        slice.data = new Uint8Array(view.buffer, 0, view.buffer.byteLength);
        scratchBuffer = slice.data;
      };
      const checkReadable = () => {
        const discardedRegions = slice.getDiscardedRegions(slicePosition, viewEnd);
        if (discardedRegions.length > 0) {
          const globalDiscardedRegions = discardedRegions.map(([start2, end2]) => `[${start2 + sliceStartGlobalPosition}, ${end2 + sliceStartGlobalPosition}]`);
          throw new Error(`Slice ${sliceIndex} for data at ${position} overlaps discarded regions: [${globalDiscardedRegions.join(", ")}]`);
        }
        if (!slice.data) {
          throw new Error(`No ArrayBuffer for slice ${sliceIndex} at position ${position}`);
        }
      };
      const getView = () => {
        checkReadable();
        return new Uint8Array(slice.data.buffer, slice.data.byteOffset + slicePosition, slice.data.byteOffset + viewLength);
      };
      yield {
        getView,
        discardView,
        setView,
        checkReadable
      };
      previousSlice = slice;
      position += viewLength;
    }
  }
  async readInternal(destAddress, offset, count, discard) {
    if (this.isReading) {
      throw new Error("Concurrent reads are not supported");
    }
    this.isReading = true;
    try {
      for (const { getView, setView, checkReadable } of this.getViews(this.globalPosition, offset)) {
        checkReadable();
        const newView = await this.fillBufferFromStream(getView());
        setView(newView);
        if (newView.length === 0) {
          break;
        }
      }
      const endOfCachedRead = Math.min(this.globalPosition, offset + count);
      for (const { getView, discardView } of this.getViews(offset, endOfCachedRead)) {
        const view = getView();
        this.getWasmHeap().set(view, destAddress);
        if (discard)
          discardView();
        destAddress += view.length;
      }
      const startOfUncachedRead = Math.max(endOfCachedRead, offset);
      for (const { getView, setView, discardView } of this.getViews(startOfUncachedRead, offset + count)) {
        if (this.streamDone && this.globalPosition <= startOfUncachedRead)
          break;
        const newView = await this.fillBufferFromStream(getView());
        setView(newView);
        this.getWasmHeap().set(newView, destAddress);
        if (discard)
          discardView();
        destAddress += newView.length;
      }
    } finally {
      this.isReading = false;
    }
  }
  async fillBufferFromStream(buffer) {
    const byteLength = buffer.byteLength;
    if (byteLength === 0) {
      return buffer;
    }
    const byteOffset = buffer.byteOffset;
    let bytesRead = 0;
    let arrayBuffer = buffer.buffer;
    while (bytesRead < byteLength) {
      if (this.streamDone && (!this.leftoverData || this.leftoverData.length === 0)) {
        throw new Error(`Read from stream returned early EOF at position ${this.globalPosition}. Expected ${byteLength - bytesRead} more bytes.`);
      }
      if (this.reader.byobReader) {
        const view = new Uint8Array(arrayBuffer, byteOffset + bytesRead, byteLength - bytesRead);
        const result2 = await this.reader.byobReader.read(view);
        if (result2.done) {
          this.streamDone = true;
        }
        if (!result2.value) {
          throw new Error("Read from stream returned null value");
        }
        this.globalPosition += result2.value.byteLength;
        bytesRead += result2.value.byteLength;
        arrayBuffer = result2.value.buffer;
      } else {
        let chunk;
        if (this.leftoverData && this.leftoverData.length > 0) {
          chunk = this.leftoverData;
          this.leftoverData = void 0;
        } else {
          const result2 = await this.reader.defaultReader.read();
          if (result2.done) {
            this.streamDone = true;
            if (!result2.value) {
              continue;
            }
          }
          if (!result2.value) {
            throw new Error("Read from stream returned null value");
          }
          chunk = result2.value;
        }
        const bytesNeeded = byteLength - bytesRead;
        const bytesToCopy = Math.min(chunk.length, bytesNeeded);
        const destView = new Uint8Array(arrayBuffer, byteOffset + bytesRead, bytesToCopy);
        destView.set(chunk.subarray(0, bytesToCopy));
        if (chunk.length > bytesToCopy) {
          this.leftoverData = chunk.subarray(bytesToCopy);
        }
        this.globalPosition += bytesToCopy;
        bytesRead += bytesToCopy;
      }
    }
    const result = new Uint8Array(arrayBuffer, byteOffset, bytesRead);
    if (result.length !== byteLength) {
      throw new Error(`Read from stream returned ${result.length} bytes, expected ${byteLength}`);
    }
    return result;
  }
  doDiscard(offset, count) {
    for (const { discardView } of this.getViews(offset, offset + count)) {
      discardView();
    }
  }
  async readAndDiscard(destAddress, offset, count) {
    try {
      await this.readInternal(destAddress >>> 0, toNumber(offset), toNumber(count), true);
      return {};
    } catch (e) {
      return { error: e };
    }
  }
  async readAndPreserve(destAddress, offset, count) {
    try {
      await this.readInternal(destAddress >>> 0, toNumber(offset), toNumber(count), false);
      return {};
    } catch (e) {
      return { error: e };
    }
  }
  discard(offset, count) {
    try {
      this.doDiscard(toNumber(offset), toNumber(count));
      return {};
    } catch (e) {
      return { error: e };
    }
  }
};
function toNumber(val) {
  if (typeof val === "number") {
    return val;
  }
  if (val > Number.MAX_SAFE_INTEGER) {
    throw new Error(`BigInt value ${val} too large to be represented as a number`);
  }
  return Number(val);
}

// node_modules/@litert-lm/core/dist/session_config.js
function sessionConfigToWasmSessionConfig(sessionConfig, wasm = getGlobalLiteRtLm().liteRtLmWasm) {
  const wasmSessionConfig = wasm.SessionConfig.createDefault();
  if (sessionConfig.audioModalityEnabled !== void 0) {
    wasmSessionConfig.setAudioModalityEnabled(sessionConfig.audioModalityEnabled);
  }
  if (sessionConfig.visionModalityEnabled !== void 0) {
    wasmSessionConfig.setVisionModalityEnabled(sessionConfig.visionModalityEnabled);
  }
  if (sessionConfig.samplerParams !== void 0) {
    const samplerParams = wasmSessionConfig.getMutableSamplerParams();
    if (sessionConfig.samplerParams.type !== void 0) {
      samplerParams.setType({ value: sessionConfig.samplerParams.type });
    }
    if (sessionConfig.samplerParams.k !== void 0) {
      samplerParams.setK(sessionConfig.samplerParams.k);
    }
    if (sessionConfig.samplerParams.p !== void 0) {
      samplerParams.setP(sessionConfig.samplerParams.p);
    }
    if (sessionConfig.samplerParams.temperature !== void 0) {
      samplerParams.setTemperature(sessionConfig.samplerParams.temperature);
    }
    if (sessionConfig.samplerParams.seed !== void 0) {
      samplerParams.setSeed(sessionConfig.samplerParams.seed);
    }
  }
  if (sessionConfig.startTokenId !== void 0) {
    wasmSessionConfig.setStartTokenId(sessionConfig.startTokenId);
  }
  if (sessionConfig.numOutputCandidates !== void 0) {
    wasmSessionConfig.setNumOutputCandidates(sessionConfig.numOutputCandidates);
  }
  if (sessionConfig.samplerBackend !== void 0) {
    wasmSessionConfig.setSamplerBackend({ value: sessionConfig.samplerBackend });
  }
  if (sessionConfig.applyPromptTemplateInSession !== void 0) {
    wasmSessionConfig.setApplyPromptTemplateInSession(sessionConfig.applyPromptTemplateInSession);
  }
  if (sessionConfig.useExternalSampler !== void 0) {
    wasmSessionConfig.setUseExternalSampler(sessionConfig.useExternalSampler);
  }
  if (sessionConfig.maxOutputTokens !== void 0) {
    wasmSessionConfig.setMaxOutputTokens(sessionConfig.maxOutputTokens);
  }
  if (sessionConfig.stopTokenIds !== void 0) {
    const outerVec = new wasm.VectorVectorInt();
    for (const innerArr of sessionConfig.stopTokenIds) {
      const innerVec = new wasm.VectorInt();
      fillEmscriptenVector(innerArr, innerVec);
      outerVec.push_back(innerVec);
      innerVec.delete();
    }
    wasmSessionConfig.setStopTokenIds(outerVec);
    outerVec.delete();
  }
  return wasmSessionConfig;
}
function wasmSessionConfigToSessionConfig(wasmSessionConfig) {
  const samplerParams = wasmSessionConfig.getMutableSamplerParams();
  return {
    audioModalityEnabled: wasmSessionConfig.getAudioModalityEnabled(),
    visionModalityEnabled: wasmSessionConfig.getVisionModalityEnabled(),
    samplerParams: {
      type: samplerParams.type().value,
      k: samplerParams.k(),
      p: samplerParams.p(),
      temperature: samplerParams.temperature(),
      seed: samplerParams.seed()
    },
    stopTokenIds: consumeEmscriptenVectorToArray(wasmSessionConfig.getStopTokenIds()).map(consumeEmscriptenVectorToArray),
    startTokenId: wasmSessionConfig.getStartTokenId(),
    numOutputCandidates: wasmSessionConfig.getNumOutputCandidates(),
    samplerBackend: wasmSessionConfig.getSamplerBackend().value,
    applyPromptTemplateInSession: wasmSessionConfig.getApplyPromptTemplateInSession(),
    useExternalSampler: wasmSessionConfig.getUseExternalSampler(),
    maxOutputTokens: wasmSessionConfig.getMaxOutputTokens()
  };
}

// node_modules/@litert-lm/core/dist/session.js
var BUSY_MESSAGE3 = "Session is busy. An operation is already in progress.";
var Session = class _Session {
  session;
  mutexes;
  config;
  isBusy = false;
  constructor(session, mutexes) {
    this.session = session;
    this.mutexes = mutexes;
    const wasmSessionConfig = session.getSessionConfig();
    this.config = wasmSessionConfigToSessionConfig(wasmSessionConfig);
    wasmSessionConfig.delete();
  }
  async runPrefill(inputs) {
    if (this.isBusy) {
      throw new Error(BUSY_MESSAGE3);
    }
    this.isBusy = true;
    try {
      await this.mutexes.executor.acquireAndRun(async () => {
        await this.session.runPrefill(inputs);
      });
    } finally {
      this.isBusy = false;
    }
  }
  async runDecode() {
    if (this.isBusy) {
      throw new Error(BUSY_MESSAGE3);
    }
    this.isBusy = true;
    try {
      return await this.mutexes.executor.acquireAndRun(async () => {
        const wasmResponses = await this.session.runDecode();
        return new Responses(wasmResponses);
      });
    } finally {
      this.isBusy = false;
    }
  }
  /**
   * Sends a signal to cancel any current generation.
   */
  cancel() {
    this.session.cancelProcess();
  }
  /**
   * Clones the session. The cloned session will have all the settings and
   * context of the original session up to the point that clone is called.
   */
  async clone() {
    if (this.isBusy) {
      throw new Error(BUSY_MESSAGE3);
    }
    this.isBusy = true;
    try {
      return await this.mutexes.executor.acquireAndRun(() => {
        const wasmClonedSession = this.session.clone();
        return new _Session(wasmClonedSession, this.mutexes);
      });
    } finally {
      this.isBusy = false;
    }
  }
  async delete() {
    await this.mutexes.executor.acquireAndRun(() => {
      this.session.delete();
    });
  }
};
var Responses = class {
  responses;
  constructor(responses) {
    this.responses = responses;
  }
  getTexts() {
    const texts = this.responses.getTexts();
    return consumeEmscriptenVectorToArray(texts);
  }
  delete() {
    this.responses.delete();
  }
};

// node_modules/@litert-lm/core/dist/engine.js
var modelPathIndex = 0;
var Engine = class _Engine {
  wasm;
  engine;
  deleteCallback;
  settings;
  mutexes = {
    executor: new Mutex()
  };
  constructor(wasm, engine, modelSource, deleteCallback) {
    this.wasm = wasm;
    this.engine = engine;
    this.deleteCallback = deleteCallback;
    const wasmEngineSettings = engine.getEngineSettings();
    const settingsWithoutModel = wasmEngineSettingsToEngineSettings(wasmEngineSettings);
    this.settings = {
      ...settingsWithoutModel,
      model: modelSource
    };
    wasmEngineSettings.delete();
  }
  static async create(engineSettings, inputPromptAsHint = "") {
    const litertlm = await getOrLoadGlobalLiteRtLm();
    const wasm = litertlm.liteRtLmWasm;
    const dstPath = `/model_${modelPathIndex++}.litertlm`;
    const backend = engineSettings.backend ?? Backend.GPU_ARTISAN;
    engineSettings = { ...engineSettings, backend };
    const samplerBackend = engineSettings.mainExecutorSettings?.samplerBackend;
    if (backend === Backend.GPU || backend === Backend.GPU_ARTISAN || samplerBackend === Backend.GPU || samplerBackend === Backend.GPU_ARTISAN) {
      await litertlm.setupDefaultWebGpuDevice();
    }
    const cleanup = new Cleanup();
    const modelStream = await modelToStream(engineSettings.model);
    let engine;
    try {
      let modelAssets;
      const isStreaming = backend === Backend.GPU_ARTISAN;
      if (isStreaming) {
        const streamWrapper = new ReadableStreamDataStreamWrapper(modelStream, () => wasm.HEAPU8);
        const dataStream = wasm.ReadableStreamDataStream.create(streamWrapper);
        cleanup.add(() => {
          dataStream.delete();
        });
        modelAssets = wasm.ModelAssets.createStreaming(dataStream);
      } else {
        await loadModelToVfs(wasm, modelStream, dstPath);
        cleanup.add(() => {
          try {
            wasm.FS.unlink(dstPath);
          } catch (e) {
            console.error(`Error removing file from VFS:`, e);
          }
        });
        modelAssets = wasm.ModelAssets.create(dstPath);
      }
      const cleanupModelAssets = cleanup.add(() => {
        modelAssets.delete();
      });
      const wasmEngineSettings = wasm.EngineSettings.createDefault(modelAssets, { value: backend });
      cleanupModelAssets();
      const cleanupWasmEngineSettings = cleanup.add(() => {
        wasmEngineSettings.delete();
      });
      fillWasmEngineSettingsFromEngineSettings(wasmEngineSettings, engineSettings, backend, wasm);
      wasmEngineSettings.setParallelFileSectionLoading(false);
      wasmEngineSettings.setSingleThreadedExecution(true);
      if (isStreaming) {
        engine = await wasm.Engine.createStreaming(wasmEngineSettings, inputPromptAsHint);
      } else {
        engine = await wasm.Engine.createEngine(wasmEngineSettings, inputPromptAsHint);
      }
      cleanupWasmEngineSettings();
      cleanup.add(() => {
        engine.delete();
      });
      return new _Engine(wasm, engine, engineSettings.model, () => cleanup.run());
    } catch (e) {
      cleanup.run();
      throw e;
    }
  }
  async createSession(sessionConfig = {}) {
    return this.mutexes.executor.acquireAndRun(() => {
      const wasmSessionConfig = sessionConfigToWasmSessionConfig(sessionConfig, this.wasm);
      const wasmSession = this.engine.createSession(wasmSessionConfig);
      wasmSessionConfig.delete();
      return new Session(wasmSession, this.mutexes);
    });
  }
  async createConversation(config) {
    return this.mutexes.executor.acquireAndRun(async () => {
      let wasmConfig;
      let wasmSessionConfig;
      if (config) {
        wasmSessionConfig = sessionConfigToWasmSessionConfig(config.sessionConfig || {}, this.wasm);
        const prefaceJson = config.preface ? JSON.stringify(config.preface) : "";
        wasmConfig = this.wasm.ConversationConfig.createCustom(this.engine, wasmSessionConfig, !!config.enableConstrainedDecoding, !!config.prefillPrefaceOnInit, !!config.filterChannelContentFromKvCache, prefaceJson);
      } else {
        wasmConfig = this.wasm.ConversationConfig.createDefault(this.engine);
      }
      const wasmConversation = await this.wasm.Conversation.create(this.engine, wasmConfig);
      wasmConfig.delete();
      if (wasmSessionConfig) {
        wasmSessionConfig.delete();
      }
      return new Conversation(wasmConversation, this.engine, this.mutexes);
    });
  }
  async delete() {
    await this.mutexes.executor.acquireAndRun(() => {
      this.deleteCallback();
    });
  }
};
async function modelToStream(model) {
  if (model instanceof ReadableStream) {
    return model;
  }
  if (model instanceof Blob) {
    return model.stream();
  }
  const modelUrl = model;
  const response = await fetch(modelUrl, {
    credentials: "same-origin"
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch model file from ${modelUrl}`);
  }
  return response.body;
}
async function loadModelToVfs(module, modelStream, dstPath) {
  let fileContent;
  const reader = modelStream.getReader();
  const chunks = [];
  let totalLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done)
      break;
    if (value) {
      chunks.push(value);
      totalLength += value.length;
    }
  }
  fileContent = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    fileContent.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    module.FS.writeFile(dstPath, fileContent);
  } catch (e) {
    console.error(`Error writing file to VFS:`, e);
    throw e;
  }
}

// node_modules/@litert-lm/core/dist/conversation_config.js
var SUPPORTED_IMAGE_MIME_TYPES = /* @__PURE__ */ new Set([
  "image/jpeg",
  "image/png",
  "image/bmp",
  "image/gif",
  "image/x-tga",
  "image/vnd.adobe.photoshop",
  "image/vnd.radiance",
  "image/x-portable-pixmap",
  "image/x-portable-graymap"
]);
var SUPPORTED_AUDIO_MIME_TYPES = /* @__PURE__ */ new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp3",
  "audio/mpeg",
  "audio/flac",
  "audio/x-flac"
]);

// node_modules/@litert-lm/core/dist/embedding_engine_settings.js
var DEFAULT_MAX_INPUT_LENGTH = 1024;
function fillWasmEmbeddingEngineSettingsFromEmbeddingEngineSettings(wasmSettings, settings, backend) {
  const wasmExecutorSettings = wasmSettings.getMutableMainExecutorSettings();
  wasmExecutorSettings.setCacheDir(":nocache");
  const maxInputLength = settings.maxInputLength ?? DEFAULT_MAX_INPUT_LENGTH;
  wasmSettings.setMaxInputLength(maxInputLength);
  wasmSettings.setMinInputLength(settings.minInputLength ?? maxInputLength);
  if (settings.visionTokensPerImage !== void 0) {
    wasmSettings.setVisionTokensPerImage(settings.visionTokensPerImage);
  }
  if (settings.mainExecutorSettings) {
    const mainExecutorSettings = settings.mainExecutorSettings;
    if (mainExecutorSettings.numThreads !== void 0) {
      wasmExecutorSettings.setNumThreads(mainExecutorSettings.numThreads);
    }
  }
}

// node_modules/@litert-lm/core/dist/stream_utils.js
async function modelToStream2(model) {
  if (model instanceof ReadableStream) {
    return model;
  }
  if (model instanceof Blob) {
    return model.stream();
  }
  const modelUrl = model;
  const response = await fetch(modelUrl, {
    credentials: "same-origin"
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch model file from ${modelUrl}`);
  }
  return response.body;
}

// node_modules/@litert-lm/core/dist/embedding_engine.js
function toWasmEmbeddingOptions(options) {
  return {
    normalize: options?.normalize ?? true,
    insertSpecialTokens: options?.insertSpecialTokens ?? true,
    inputOverflowStrategy: options?.inputOverflowStrategy ?? InputOverflowStrategy.ERROR,
    visionTokensPerImage: options?.visionTokensPerImage,
    outputSize: options?.outputSize
  };
}
async function normalizeInputPart(part) {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part instanceof Blob) {
    const mimeType = part.type.toLowerCase().split(";")[0].trim();
    if (SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
      const arrayBuffer = await part.arrayBuffer();
      return { type: "image", data: arrayBuffer };
    }
    if (SUPPORTED_AUDIO_MIME_TYPES.has(mimeType)) {
      const arrayBuffer = await part.arrayBuffer();
      return { type: "audio", data: arrayBuffer };
    }
    throw new Error(`Unsupported Blob mime type: "${part.type}". Supported image types: ${[...SUPPORTED_IMAGE_MIME_TYPES].join(", ")}. Supported audio types: ${[...SUPPORTED_AUDIO_MIME_TYPES].join(", ")}.`);
  }
  if (typeof part === "object" && part !== null) {
    if (part.type === "image") {
      if (part.data instanceof Blob) {
        const arrayBuffer = await part.data.arrayBuffer();
        return { type: "image", data: arrayBuffer };
      }
      return part;
    }
    if (part.type === "audio") {
      if (part.data instanceof Blob) {
        const arrayBuffer = await part.data.arrayBuffer();
        return { type: "audio", data: arrayBuffer };
      }
      return part;
    }
    return part;
  }
  throw new Error(`Unsupported input part: ${JSON.stringify(part)}`);
}
async function normalizeInput(input) {
  if (Array.isArray(input)) {
    return Promise.all(input.map((p) => normalizeInputPart(p)));
  }
  return normalizeInputPart(input);
}
var EmbeddingEngine = class _EmbeddingEngine {
  engine;
  deleteCallback;
  settings;
  mutex = new Mutex();
  constructor(engine, settings, deleteCallback) {
    this.engine = engine;
    this.deleteCallback = deleteCallback;
    this.settings = settings;
  }
  static async create(settings) {
    const litertlm = await getOrLoadGlobalLiteRtLm();
    const wasm = litertlm.liteRtLmWasm;
    const backend = settings.backend ?? Backend.GPU;
    settings = { ...settings, backend };
    if (backend === Backend.GPU || backend === Backend.GPU_ARTISAN) {
      await litertlm.setupDefaultWebGpuDevice();
    }
    const cleanup = new Cleanup();
    const modelStream = await modelToStream2(settings.model);
    let engine;
    try {
      const streamWrapper = new ReadableStreamDataStreamWrapper(modelStream, () => wasm.HEAPU8);
      const dataStream = wasm.ReadableStreamDataStream.create(streamWrapper);
      cleanup.add(() => {
        dataStream.delete();
      });
      const modelAssets = wasm.ModelAssets.createStreaming(dataStream);
      const cleanupModelAssets = cleanup.add(() => {
        modelAssets.delete();
      });
      const wasmSettings = wasm.EmbeddingEngineSettings.createDefaultMultimodal(
        modelAssets,
        { value: backend },
        settings.visionBackend !== void 0 ? { value: settings.visionBackend } : void 0,
        // Skip vision backend if not set.
        settings.audioBackend !== void 0 ? { value: settings.audioBackend } : void 0
      );
      cleanupModelAssets();
      const cleanupWasmSettings = cleanup.add(() => {
        wasmSettings.delete();
      });
      const resolvedBackend = wasmSettings.getMutableMainExecutorSettings().getBackend().value;
      fillWasmEmbeddingEngineSettingsFromEmbeddingEngineSettings(wasmSettings, settings, resolvedBackend);
      try {
        engine = await wasm.EmbeddingEngine.createEngine(wasmSettings);
      } finally {
        if (resolvedBackend === Backend.GPU) {
          try {
            await wasm.clearStoredWeightsStreams();
          } catch (cleanupError) {
            console.error("Error during cleanup:", cleanupError);
          }
        }
      }
      cleanupWasmSettings();
      cleanup.add(() => {
        engine.delete();
      });
      return new _EmbeddingEngine(engine, settings, () => cleanup.run());
    } catch (e) {
      cleanup.run();
      throw e;
    }
  }
  async computeEmbedding(input, options = {}) {
    const normalized = await normalizeInput(input);
    return this.mutex.acquireAndRun(async () => {
      const wasmResponse = await this.engine.computeEmbedding(normalized, toWasmEmbeddingOptions(options));
      const embedding = consumeEmscriptenVectorToArray(wasmResponse.embedding);
      return {
        embedding,
        inputLength: wasmResponse.inputLength,
        truncatedLength: wasmResponse.truncatedLength,
        numChunks: wasmResponse.numChunks
      };
    });
  }
  async computeEmbeddingBatch(inputs, options = {}) {
    const normalizedBatch = await Promise.all(inputs.map(normalizeInput));
    return this.mutex.acquireAndRun(async () => {
      const wasmResponses = await this.engine.computeEmbeddingBatch(normalizedBatch, toWasmEmbeddingOptions(options));
      try {
        const responses = [];
        const count = wasmResponses.size();
        for (let i = 0; i < count; i++) {
          const wasmResp = wasmResponses.get(i);
          const embedding = consumeEmscriptenVectorToArray(wasmResp.embedding);
          responses.push({
            embedding,
            inputLength: wasmResp.inputLength,
            truncatedLength: wasmResp.truncatedLength,
            numChunks: wasmResp.numChunks
          });
        }
        return responses;
      } finally {
        wasmResponses.delete();
      }
    });
  }
  async delete() {
    await this.mutex.acquireAndRun(() => {
      this.deleteCallback();
    });
  }
};
export {
  AutoToolChat,
  Backend,
  Conversation,
  EmbeddingEngine,
  Engine,
  InputOverflowStrategy,
  LiteRtLm,
  LiteRtLmNotLoadedError,
  SUPPORTED_AUDIO_MIME_TYPES,
  SUPPORTED_IMAGE_MIME_TYPES,
  SamplerType,
  Session,
  wasm_binding_types_exports as Wasm,
  fillWasmEmbeddingEngineSettingsFromEmbeddingEngineSettings,
  fillWasmEngineSettingsFromEngineSettings,
  getGlobalLiteRtLm,
  getGlobalLiteRtLmPromise,
  getOrLoadGlobalLiteRtLm,
  hasGlobalLiteRtLm,
  hasGlobalLiteRtLmPromise,
  isWebMcpTool,
  loadLiteRtLm,
  sessionConfigToWasmSessionConfig,
  setGlobalLiteRtLm,
  setGlobalLiteRtLmPromise,
  setupDefaultWebGpuDevice,
  toTool,
  unloadLiteRtLm,
  wasmEngineSettingsToEngineSettings,
  wasmSessionConfigToSessionConfig
};
