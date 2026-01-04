import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { Input } from "antd";
import { TextAreaRef } from "antd/es/input/TextArea";
import { useRef, useState } from "react";
import { Panel, PanelResizeHandle } from "react-resizable-panels";

export default function useInputPanel(props:{
  inputTag: string;
}){  
  const [collapseInput1, setCollapseInput1] = useState(false);

  // Use refs instead of state to avoid re-renders
  const input2Ref = useRef<TextAreaRef>(null);

  // Function to get current values from refs
  const getUserInput = () => ({
    input1: input2Ref.current?.resizableTextArea?.textArea.value || '',
  });
  
  const element = (
    <>
      <div className=' w-full flex items-center justify-center mb-1'>
        <div 
          className=' h-3 w-32 bg-neutral-700 hover:bg-neutral-600 flex items-center justify-center cursor-pointer rounded-sm'
          onClick={() => setCollapseInput1(prev => !prev)}
        >
          {collapseInput1 ? <UpOutlined className='text-gray-300' /> : <DownOutlined className='text-gray-300' />}
        </div>
      </div>
      <Panel defaultSize={10} minSize={5} order={3}>
        <Input.TextArea
          className=' h-full'
          placeholder={props.inputTag}
          ref={input2Ref}
        />
      </Panel>
    </>
  );

  return { element, getUserInput };
}