import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CircleDashedPostIt } from "./CircleDashedPostIt";

describe("CircleDashedPostIt", () => {
  it("renderiza SVG visual com viewBox, cores e preserveAspectRatio", () => {
    render(
      <CircleDashedPostIt
        backgroundColor="#FFFFFF"
        patternColor="#123456"
        patternOpacity={0.45}
        preserveAspectRatio={false}
        className="post-it-background"
      />,
    );

    const svg = document.querySelector("svg");
    const background = document.querySelector("rect[fill='#FFFFFF']");
    const line = document.querySelector("line");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", "0 0 100 100");
    expect(svg).toHaveAttribute("preserveAspectRatio", "none");
    expect(svg).toHaveStyle({ pointerEvents: "none" });
    expect(background).toBeInTheDocument();
    expect(line).toHaveAttribute("stroke", "#123456");
    expect(line).toHaveAttribute("stroke-opacity", "0.45");
  });

  it("gera IDs unicos para pattern e clipPath", () => {
    render(
      <>
        <CircleDashedPostIt />
        <CircleDashedPostIt />
      </>,
    );

    const patternIds = Array.from(document.querySelectorAll("pattern")).map((pattern) => pattern.id);
    const clipIds = Array.from(document.querySelectorAll("clipPath")).map((clipPath) => clipPath.id);
    expect(new Set(patternIds).size).toBe(2);
    expect(new Set(clipIds).size).toBe(2);
  });

  it("nao cria conteudo interativo", () => {
    render(<CircleDashedPostIt />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
