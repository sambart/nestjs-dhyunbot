import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class ChannelModel {
  @Field(() => Int)
  id: number;

  @Field()
  discordChannelId: string;

  @Field()
  channelName: string;

  @Field({ nullable: true })
  type: string;

  @Field()
  createdAt: Date;
}
