import { isOpenAIImageModel } from "@/app/utils";
import { useAccessStore } from "@/app/store";

describe("isOpenAIImageModel util", () => {
  beforeEach(() => {
    // reset visionModels
    useAccessStore.setState({ visionModels: "" });
  });

  test("returns true for dall-e-3 and gpt-image-1", () => {
    expect(isOpenAIImageModel("dall-e-3")).toBe(true);
    expect(isOpenAIImageModel("gpt-image-1")).toBe(true);
  });

  test("returns true when model in env visionModels override", () => {
    useAccessStore.setState({ visionModels: "my-vision-model" });
    expect(isOpenAIImageModel("my-vision-model")).toBe(true);
  });
});
