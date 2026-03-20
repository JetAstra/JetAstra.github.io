# MacAgentBench 开源发布文案

很多 OpenClaw Benchmark 主要在 Linux 上测试，但真到大家自己养虾的时候，Mac 往往才是第一选择。  
Mac mini 的供不应求也说明了，Mac 才是最好的虾壳。

不管是 Notes、Reminders、Pages、Numbers、Keynote，还是邮件、GitHub、终端工具协同，这些才更接近大家真的怎么用 Agent。

所以我们把我们做的 Mac 养虾指南 `MacAgentBench` 开源啦！

## 首发指北榜单

- Claude Opus 4.6 Thinking 分数最高（83.64）
- GPT-5.4 运行最快（平均 37.31s / task）
- 考虑综合性价比，MiniMax M2.5 是个很不错的选择（70.0 分，平均仅 $0.018 / task）

## MacAgentBench 提供什么

- 提供一个开箱即用的 macOS 版 OpenClaw 环境，可通过 Docker 在 Linux 和 Windows 上直接运行。也就是说，就算你手头不是 Mac，也可以先在别的平台把整套环境跑起来，里面配好了一只全副武装的龙虾，随时准备接管你的 Mac 工作流。
- Benchmark 覆盖 110 个任务、18 类 macOS 应用与工具场景，包含 Notes、Reminders、Numbers、Pages、Keynote、GitHub、邮件，以及 tmux、Whisper、多媒体等真实工作流任务。
- 人工设计的规则评测器，而不是直接让 LLM 当裁判。
- 每个任务都在独立容器中执行，尽量减少相互干扰，让结果更稳定，也更可复现。

## 链接

- GitHub: [JetAstra/MacAgentBench](https://github.com/JetAstra/MacAgentBench)
- Leaderboard: <https://jetastra.github.io/MacAgentBench/>

快来看看你的虾在哪，大家最想看哪个模型上榜？我继续测。
