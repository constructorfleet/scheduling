import "@testing-library/jest-dom";

// Mock Framer Motion to make animations instant in tests
jest.mock("framer-motion", () => {
  const React = require("react");
  const actual = jest.requireActual("framer-motion");

  return {
    ...actual,
    motion: new Proxy(actual.motion, {
      get: (target, prop) => {
        if (typeof prop === "string" && prop in target) {
          return React.forwardRef((props: any, ref: any) => {
            const { initial, animate, exit, transition, layout, layoutId, whileHover, whileTap, ...rest } = props;
            return React.createElement(prop, { ...rest, ref });
          });
        }
        return target[prop as any];
      },
    }),
    AnimatePresence: ({ children }: any) => children,
  };
});
