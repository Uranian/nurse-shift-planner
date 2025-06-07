// 📄 src/components/NoSSR.jsx
import dynamic from "next/dynamic";

const NoSSR = (Component) =>
  dynamic(() => Promise.resolve(Component), {
    ssr: false,
  });

export default NoSSR;
