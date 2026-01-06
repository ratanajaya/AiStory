const _constant = {
  newLine: '\n',
  newLine2: '\n\n',

  longDummyText: `Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.

Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a, venenatis vitae, justo.

Nullam dictum felis eu pede mollis pretium. Integer tincidunt. Cras dapibus. Vivamus elementum semper nisi. Aenean vulputate eleifend tellus. Aenean leo ligula, porttitor eu, consequat vitae, eleifend ac, enim. Aliquam lorem ante, dapibus in, viverra quis, feugiat a, tellus.

Phasellus viverra nulla ut metus varius laoreet. Quisque rutrum. Aenean imperdiet. Etiam ultricies nisi vel augue. Curabitur ullamcorper ultricies nisi. Nam eget dui. Etiam rhoncus.

Maecenas tempus, tellus eget condimentum rhoncus, sem quam semper libero, sit amet adipiscing sem neque sed ipsum. Nam quam nunc, blandit vel, luctus pulvinar, hendrerit id, lorem. Maecenas nec odio et ante tincidunt tempus. Donec vitae sapien ut libero venenatis faucibus. Nullam quis ante. Etiam sit amet orci eget eros faucibus tincidunt. Duis leo. Sed fringilla mauris sit amet nibh. Donec sodales sagittis magna. Sed consequat, leo eget bibendum sodales, augue velit cursus nunc.`,

  llmServices: {
    mistral: {
      label: 'Mistral AI',
      provider: 'mistral',
      models: [
        'mistral-large-2411',
        'mistral-large-latest',
      ],
    },
    together: {
      label: 'Together AI',
      provider: 'together',
      models: [
        'deepseek-ai/DeepSeek-V3',
        'deepseek-ai/DeepSeek-V3.1',
        'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
        'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
        'Qwen/Qwen3-235B-A22B-Instruct-2507-tput',
        //'MiniMaxAI/MiniMax-M1-80k', //doesn't exist
        //'zai-org/GLM-4.6', //not good
      ],
    },
  },
}

export default _constant;