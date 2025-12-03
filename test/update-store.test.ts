import { useUpdateStore } from "../app/store/update";

describe("useUpdateStore setUsage", () => {
  beforeEach(() => {
    // reset state
    useUpdateStore.setState({ used: 0, subscription: 0, lastUpdateUsage: 0 });
  });

  test("set usage should update used and subscription", () => {
    const stateBefore = useUpdateStore.getState();
    expect(stateBefore.used).toBe(0);
    expect(stateBefore.subscription).toBe(0);

    useUpdateStore.getState().setUsage(123, 456);

    const stateAfter = useUpdateStore.getState();
    expect(stateAfter.used).toBe(123);
    expect(stateAfter.subscription).toBe(456);
    expect(stateAfter.lastUpdateUsage).toBeGreaterThan(0);
  });
});
