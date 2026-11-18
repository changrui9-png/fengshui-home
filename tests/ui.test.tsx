import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/ui/App";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ aiConfigured: false, provider: null, destinationHost: null, reason: "not-set" }) })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("界面", () => {
  it("示例、未配置的视频说明、确认门闩和不完整电梯都能走通", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText(/自动视频解读尚未配置/)).toBeInTheDocument();
    expect(screen.getByText(/没有分析视频/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "载入完整示例" }));
    expect(screen.getByText(/示例数据，不是真实住宅/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "评估" }));
    expect(screen.getByRole("heading", { name: "评估预览" })).toBeInTheDocument();
    expect(screen.getByText(/这不是最终评估/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成最终评估" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "户型" }));
    await user.click(screen.getByLabelText("确认房间拓扑"));
    await user.click(screen.getByLabelText("确认朝向"));
    await user.click(screen.getByLabelText("确认家具"));
    await user.click(screen.getByRole("button", { name: "评估" }));
    await user.click(screen.getByRole("button", { name: "生成最终评估" }));
    expect(screen.getByRole("heading", { name: "最终评估" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "材料" }));
    await user.click(screen.getByRole("button", { name: "载入信息不完整的示例" }));
    await user.click(screen.getByRole("button", { name: "澄清" }));
    expect(screen.getByText(/是否靠近电梯/)).toBeInTheDocument();
    expect(screen.getByText(/电梯门朝/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "材料" }));
    await user.click(screen.getByRole("button", { name: "从空白平面开始" }));
    await user.click(screen.getByRole("button", { name: "户型" }));
    await user.click(screen.getByRole("button", { name: "男主人房" }));
    expect(screen.getByDisplayValue("男主人房")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "女主人房" }));
    expect(screen.getByDisplayValue("女主人房")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "门" }));
    expect(screen.getByRole("heading", { name: "门" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "窗" }));
    expect(screen.getByRole("heading", { name: "窗" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "阳台" }));
    expect(screen.getByRole("textbox", { name: "名称" })).toHaveValue("阳台");
    await user.click(screen.getByRole("button", { name: "厕所" }));
    expect(screen.getByRole("textbox", { name: "名称" })).toHaveValue("厕所");

    await user.click(screen.getByRole("button", { name: "导出" }));
    expect(screen.getByRole("button", { name: "下载 JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载 SVG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载 PNG" })).toBeInTheDocument();
  });

  it("损坏的项目文件会显示错误，而不会装成已导入", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByTestId("import-json");
    await user.upload(input, new File(["{"], "bad.json", { type: "application/json" }));
    expect(await screen.findByText(/不是有效的 JSON/)).toBeInTheDocument();
    expect(screen.queryByText(/示例数据，不是真实住宅/)).not.toBeInTheDocument();
  });
});
