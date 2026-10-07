import React from 'react';

// --- @lobehub/ui shim ---
export const Center = ({ children, className, style, ...props }) =>
  React.createElement(
    'div',
    {
      className,
      style: { display: 'flex', alignItems: 'center', justifyContent: 'center', ...style },
      ...props,
    },
    children,
  );

export const Flexbox = ({
  children,
  className,
  style,
  horizontal,
  direction,
  align,
  justify,
  gap,
  ...props
}) =>
  React.createElement(
    'div',
    {
      className,
      style: {
        display: 'flex',
        flexDirection: direction || (horizontal ? 'row' : 'column'),
        alignItems: align,
        justifyContent: justify,
        gap,
        ...style,
      },
      ...props,
    },
    children,
  );

export const Icon = ({ icon: IconComponent, size, ...props }) => {
  if (!IconComponent) return null;
  return typeof IconComponent === 'function'
    ? React.createElement(IconComponent, { size, ...props })
    : IconComponent;
};

export const Tag = ({ children, icon, className, ...props }) =>
  React.createElement('span', { className, ...props }, icon, children);

export const Divider = (props) => React.createElement('hr', props);
export const Block = ({ children, ...props }) => React.createElement('div', props, children);
export const Text = ({ children, ...props }) => React.createElement('span', props, children);
export const Empty = () => null;
export const ActionIcon = ({ children, ...props }) =>
  React.createElement('button', props, children);
export const CopyButton = () => null;
export const Segmented = () => null;
export const StoryBook = () => null;
export const Highlight = ({ children }) => React.createElement('span', null, children);
const noop = () => undefined;
export const useCopied = () => [false, noop];
export const ProviderIcon = () => null;

// --- antd shim for antd-style ---
export const version = '5.24.0';

const ConfigContext = React.createContext({
  getPrefixCls: (suffixCls) => `ant-${suffixCls}`,
  theme: {},
});

export const ConfigProvider = ({ children }) => children;
ConfigProvider.ConfigContext = ConfigContext;

export const theme = {
  useToken: () => ({
    theme: {},
    token: {
      colorText: 'inherit',
      colorBgContainer: 'transparent',
    },
    hashId: '',
  }),
  getDesignToken: () => ({ colorPrimary: '#1677ff', colorText: '#000000', colorBgContainer: '#ffffff' }),
  defaultAlgorithm: () => ({}),
  darkAlgorithm: () => ({}),
  compactAlgorithm: () => ({}),
  defaultSeed: {},
};

export const message = {};
export const Modal = {};
export const notification = {};

export const Grid = {
  useBreakpoint: () => ({ xs: false, sm: true, md: true, lg: true, xl: true, xxl: true }),
};

export default {
  Center,
  Flexbox,
  Icon,
  Tag,
  Divider,
  Block,
  Text,
  Empty,
  ActionIcon,
  CopyButton,
  Segmented,
  StoryBook,
  Highlight,
  useCopied,
  ProviderIcon,
  version,
  ConfigProvider,
  theme,
  message,
  Modal,
  notification,
  Grid,
};
