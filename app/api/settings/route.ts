import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { KeyValueModel } from '@/models';
import { DefaultValue } from '@/types';

const DEFAULT_KEY = 'defaultValue';

export async function GET() {
  try {
    await dbConnect();
    const doc = await KeyValueModel.findOne({ key: DEFAULT_KEY });
    
    if (!doc) {
      // Return empty default value if not found
      const emptyDefaultValue: DefaultValue = {
        prompt: {
          narrator: null,
          inputTag: null,
          summarizer: null,
          summarizerEndState: null,
        },
        apiKey: {
          mistral: null,
          together: null,
          openAi: null,
        },
      };
      return NextResponse.json(emptyDefaultValue);
    }
    
    return NextResponse.json(doc.value as DefaultValue);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await dbConnect();
    const body: DefaultValue = await request.json();
    
    const doc = await KeyValueModel.findOneAndUpdate(
      { key: DEFAULT_KEY },
      { key: DEFAULT_KEY, value: body },
      { upsert: true, new: true }
    );
    
    return NextResponse.json(doc.value as DefaultValue);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
