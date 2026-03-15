import { hypocrisy } from "../generated/hypocrisy";

export default class NotionORM {
  public hypocrisy: ReturnType<typeof hypocrisy>;

  constructor(config: { auth: string }) {
    this.hypocrisy = hypocrisy(config.auth);
  }
}
