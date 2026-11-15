import { verificarDescricao } from "./regra.ts";

// O workflow passa o corpo por variável de ambiente, nunca interpolado no script.
const corpo = process.env["PR_BODY"];

if (corpo === undefined) {
  process.stderr.write("PR_BODY não chegou ao script. Confira o env do workflow.\n");
  process.exitCode = 1;
} else {
  const resultado = verificarDescricao(corpo);
  if (resultado.ok) {
    process.stdout.write("Descrição do PR ok: a referência de fechamento está correta.\n");
  } else {
    for (const erro of resultado.erros) {
      process.stderr.write(`Erro: ${erro}\n`);
    }
    process.exitCode = 1;
  }
}
